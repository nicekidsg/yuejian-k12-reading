#!/usr/bin/env python3
"""Compose exact-text HD covers from AI storybook plates and source art."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src" / "data" / "gutenberg-books.json"
REPORT_FILE = ROOT / "reports" / "cover-quality-report.json"
COVER_DIR = ROOT / "public" / "covers"
TEMPLATE_DIR = ROOT / "public" / "ai-cover-templates"
WIDTH, HEIGHT = 1200, 1600

TEMPLATES = {
    "fantasy": "fantasy.png",
    "animals": "animals.png",
    "adventure": "adventure.png",
    "growth": "growth.png",
    "world": "world.png",
}
TITLE_FONT = Path("/System/Library/Fonts/Supplemental/Georgia Bold.ttf")
AUTHOR_FONT = Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf")
META_FONT = Path("/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf")
INK = (26, 61, 75)
CREAM = (255, 252, 241)


def text_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> float:
    return draw.textlength(text, font=font)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = text.replace(";", "; ").split()
    lines = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or text_width(draw, candidate, font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def title_layout(draw: ImageDraw.ImageDraw, title: str) -> tuple[ImageFont.FreeTypeFont, list[str]]:
    for size in range(68, 35, -2):
        font = ImageFont.truetype(str(TITLE_FONT), size)
        lines = wrap_text(draw, title, font, 940)
        line_height = math.ceil(size * 1.12)
        if len(lines) <= 5 and len(lines) * line_height <= 330:
            return font, lines
    font = ImageFont.truetype(str(TITLE_FONT), 34)
    return font, wrap_text(draw, title, font, 940)[:6]


def open_art(book: dict, old_cover: str) -> tuple[Image.Image, str]:
    candidates = [
        *(book.get("originalIllustrations") or []),
        *(book.get("aiIllustrations") or []),
        old_cover,
    ]
    for relative in candidates:
        path = ROOT / "public" / relative.lstrip("/")
        try:
            image = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
            image.load()
            return image, relative
        except (OSError, ValueError):
            continue
    raise RuntimeError(f"No readable source art for {book['gutenbergId']}")


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.FreeTypeFont,
    start_y: int,
    fill: tuple[int, int, int],
) -> int:
    line_height = math.ceil(font.size * 1.12)
    y = start_y
    for line in lines:
        width = text_width(draw, line, font)
        draw.text(((WIDTH - width) / 2, y), line, font=font, fill=fill)
        y += line_height
    return y


def compose(book: dict) -> tuple[str, str]:
    old_cover = book["cover"]
    template_path = TEMPLATE_DIR / TEMPLATES.get(book.get("themeId"), "world.png")
    background = ImageOps.fit(Image.open(template_path).convert("RGB"), (WIDTH, HEIGHT), Image.Resampling.LANCZOS)
    background = ImageEnhance.Brightness(background).enhance(1.02)
    canvas = background.convert("RGBA")
    overlay = Image.new("RGBA", canvas.size, (255, 252, 241, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.rounded_rectangle((78, 80, 1122, 1518), radius=44, fill=(255, 252, 241, 210), outline=(255, 255, 255, 235), width=5)
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)

    title_font, title_lines = title_layout(draw, book["title"])
    title_height = len(title_lines) * math.ceil(title_font.size * 1.12)
    title_y = 128 + max(0, (290 - title_height) // 2)
    title_end = draw_centered_lines(draw, title_lines, title_font, title_y, INK)
    author_font = ImageFont.truetype(str(AUTHOR_FONT), 26)
    author = book.get("author") or "Public-domain classic"
    author_lines = wrap_text(draw, author, author_font, 880)[:2]
    draw_centered_lines(draw, author_lines, author_font, max(410, title_end + 18), (76, 103, 111))

    art, art_source = open_art(book, old_cover)
    source_long_edge = max(art.size)
    if source_long_edge >= 500:
        frame_size = (840, 760)
    else:
        frame_size = (620, 700)
    art = ImageOps.contain(art, (frame_size[0] - 28, frame_size[1] - 28), Image.Resampling.LANCZOS)
    art = art.filter(ImageFilter.UnsharpMask(radius=1.2, percent=105, threshold=3))
    art_frame = Image.new("RGBA", frame_size, (255, 255, 255, 0))
    frame_draw = ImageDraw.Draw(art_frame)
    frame_draw.rounded_rectangle((0, 0, *frame_size), radius=30, fill=(255, 255, 255, 246), outline=(219, 199, 156, 235), width=5)
    art_x = (frame_size[0] - art.width) // 2
    art_y = (frame_size[1] - art.height) // 2
    art_frame.paste(art.convert("RGBA"), (art_x, art_y), rounded_mask(art.size, 20))
    frame_x = (WIDTH - frame_size[0]) // 2
    frame_y = 535
    canvas.alpha_composite(art_frame, (frame_x, frame_y))

    meta_font = ImageFont.truetype(str(META_FONT), 24)
    age = book.get("ageRange") or "K12"
    meta = f"YUEJIAN CLASSICS  •  AGE {age.replace(' 岁', '')}"
    meta_width = text_width(draw, meta, meta_font)
    pill = (int((WIDTH - meta_width) / 2 - 30), 1362, int((WIDTH + meta_width) / 2 + 30), 1418)
    draw.rounded_rectangle(pill, radius=28, fill=(31, 102, 105, 224))
    draw.text(((WIDTH - meta_width) / 2, 1375), meta, font=meta_font, fill=(255, 255, 255))
    note_font = ImageFont.truetype(str(AUTHOR_FONT), 18)
    note = "AI-ASSISTED COVER • PUBLIC-DOMAIN SOURCE"
    note_width = text_width(draw, note, note_font)
    draw.text(((WIDTH - note_width) / 2, 1460), note, font=note_font, fill=(90, 112, 112))

    output_name = f"{book['gutenbergId']}-ai-hd.jpg"
    output_path = COVER_DIR / output_name
    canvas.convert("RGB").save(output_path, "JPEG", quality=91, optimize=True, progressive=True)
    return f"/covers/{output_name}", art_source


books = json.loads(BOOKS_FILE.read_text("utf-8"))
report = json.loads(REPORT_FILE.read_text("utf-8"))
status_by_id = {item["gutenbergId"]: item for item in report}
generated = 0
for index, book in enumerate(books, start=1):
    result = status_by_id[book["gutenbergId"]]
    if result["status"] != "needs-ai":
        continue
    old_cover = book["cover"]
    new_cover, art_source = compose(book)
    book["cover"] = new_cover
    book["coverSource"] = "ai-assisted-reconstruction"
    book["coverOriginalReference"] = old_cover
    book["coverGenerationNote"] = "AI 儿童绘本底纹 + 公版封面或原版插画重制，书名与作者由平台精确排版"
    result["status"] = "ai-assisted"
    result["cover"] = new_cover
    result["dimensions"] = [WIDTH, HEIGHT]
    result["artSource"] = art_source
    generated += 1
    print(f"[{index:03d}/{len(books)}] {book['gutenbergId']} {new_cover}")

BOOKS_FILE.write_text(f"{json.dumps(books, ensure_ascii=False, indent=2)}\n", "utf-8")
REPORT_FILE.write_text(f"{json.dumps(report, ensure_ascii=False, indent=2)}\n", "utf-8")
print(f"Generated {generated} AI-assisted HD covers")
