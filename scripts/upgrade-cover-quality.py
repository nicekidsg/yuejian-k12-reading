#!/usr/bin/env python3
"""Replace low-resolution covers with verified public-domain source images."""

from __future__ import annotations

import concurrent.futures
import io
import json
import re
import urllib.error
import urllib.request
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src" / "data" / "gutenberg-books.json"
COVER_DIR = ROOT / "public" / "covers"
REPORT_FILE = ROOT / "reports" / "cover-quality-report.json"
MIN_LONG_EDGE = 720
MAX_LONG_EDGE = 1800
USER_AGENT = "YuejianK12Reading/3.0 (public-domain educational reader)"


def image_dimensions(path: Path) -> tuple[int, int]:
    try:
        with Image.open(path) as image:
            return image.size
    except (OSError, ValueError):
        return (0, 0)


def source_ids(book: dict) -> list[int]:
    values = [
        book.get("gutenbergId"),
        book.get("catalogGutenbergId"),
    ]
    for key in ("coverSourceUrl", "textSourceUrl", "sourceUrl"):
        match = re.search(r"(?:ebooks|epub|files)/(\d+)", book.get(key) or "")
        if match:
            values.append(int(match.group(1)))
    return list(dict.fromkeys(int(value) for value in values if value))


def candidate_urls(book: dict) -> list[str]:
    urls = []
    source_url = book.get("coverSourceUrl") or ""
    if source_url and ".cover.medium." not in source_url and ".cover.small." not in source_url:
        urls.append(source_url)
    for source_id in source_ids(book):
        base = f"https://www.gutenberg.org/files/{source_id}/{source_id}-h/images"
        urls.extend([
            f"{base}/cover.jpg",
            f"https://www.gutenberg.org/cache/epub/{source_id}/images/cover.jpg",
        ])
    return list(dict.fromkeys(urls))


def fetch_image(url: str) -> tuple[Image.Image, bytes] | None:
    try:
        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Connection": "close"},
        )
        with urllib.request.urlopen(request, timeout=8) as response:
            if response.status != 200:
                return None
            content = response.read(30_000_001)
        if len(content) < 4_000 or len(content) > 30_000_000:
            return None
        image = Image.open(io.BytesIO(content))
        image.load()
        if max(image.size) < MIN_LONG_EDGE:
            return None
        return image, content
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        return None


def normalized_cover(image: Image.Image) -> Image.Image:
    image = ImageOps.exif_transpose(image).convert("RGB")
    if max(image.size) <= MAX_LONG_EDGE:
        return image
    scale = MAX_LONG_EDGE / max(image.size)
    return image.resize(
        (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
        Image.Resampling.LANCZOS,
    )


def upgrade(book: dict) -> dict:
    current_path = ROOT / "public" / book["cover"].lstrip("/")
    current_size = image_dimensions(current_path)
    if max(current_size) >= MIN_LONG_EDGE:
        return {
            "gutenbergId": book["gutenbergId"],
            "status": "already-hd",
            "cover": book["cover"],
            "dimensions": list(current_size),
        }

    output_name = f"{book['gutenbergId']}-hd.jpg"
    output_path = COVER_DIR / output_name
    existing_hd_size = image_dimensions(output_path)
    if max(existing_hd_size) >= MIN_LONG_EDGE:
        return {
            "gutenbergId": book["gutenbergId"],
            "status": "upgraded",
            "cover": f"/covers/{output_name}",
            "dimensions": list(existing_hd_size),
            "sourceUrl": book.get("coverSourceUrl") or book.get("sourceUrl"),
        }

    for url in candidate_urls(book):
        result = fetch_image(url)
        if not result:
            continue
        image, _ = result
        image = normalized_cover(image)
        image.save(output_path, "JPEG", quality=91, optimize=True, progressive=True)
        return {
            "gutenbergId": book["gutenbergId"],
            "status": "upgraded",
            "cover": f"/covers/{output_name}",
            "dimensions": list(image.size),
            "sourceUrl": url,
        }

    return {
        "gutenbergId": book["gutenbergId"],
        "status": "needs-ai",
        "cover": book["cover"],
        "dimensions": list(current_size),
        "sourceUrl": book.get("coverSourceUrl") or book.get("sourceUrl"),
    }


books = json.loads(BOOKS_FILE.read_text("utf-8"))
COVER_DIR.mkdir(parents=True, exist_ok=True)
results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
    futures = {executor.submit(upgrade, book): book for book in books}
    for index, future in enumerate(concurrent.futures.as_completed(futures), start=1):
        result = future.result()
        results.append(result)
        print(
            f"[{index:03d}/{len(books)}] {result['gutenbergId']} "
            f"{result['status']} {result['dimensions']}"
        )

by_id = {result["gutenbergId"]: result for result in results}
for book in books:
    result = by_id[book["gutenbergId"]]
    if result["status"] != "upgraded":
        continue
    book["cover"] = result["cover"]
    book["coverSource"] = "original-edition-hd"
    book["coverSourceUrl"] = result["sourceUrl"]

BOOKS_FILE.write_text(f"{json.dumps(books, ensure_ascii=False, indent=2)}\n", "utf-8")
REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
REPORT_FILE.write_text(
    f"{json.dumps(sorted(results, key=lambda item: item['gutenbergId']), ensure_ascii=False, indent=2)}\n",
    "utf-8",
)

counts = {
    status: sum(result["status"] == status for result in results)
    for status in ("already-hd", "upgraded", "needs-ai")
}
print(json.dumps(counts, ensure_ascii=False))
