#!/usr/bin/env python3
"""Normalize the 280 local public-domain book texts and verify their integrity."""

from __future__ import annotations

import gzip
import io
import json
import math
import re
import statistics
import subprocess
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src" / "data" / "gutenberg-books.json"
BOOKS_DIR = ROOT / "public" / "books"
REPORT_FILE = ROOT / "reports" / "text-quality-report.json"

# These catalog records point to audio/abridged derivatives. Use the complete,
# same-title Project Gutenberg text already included in the catalog.
CANONICAL_TEXTS = {
    19466: 54,     # The Marvelous Land of Oz
    19575: 47,     # Anne of Avonlea
    20781: 1448,   # Heidi
}

WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
START_MARKER_RE = re.compile(
    r"^\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*?\*{3}\s*$",
    re.IGNORECASE | re.MULTILINE,
)
END_MARKER_RE = re.compile(
    r"^\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK.*$",
    re.IGNORECASE | re.MULTILINE,
)
STANDALONE_ART_RE = re.compile(
    r"^\s*\[(?:illustration|illustrations|frontispiece|decorative image|image)\]\s*$",
    re.IGNORECASE,
)
TRAILING_SPACE_RE = re.compile(r"[ \t]+$", re.MULTILINE)


def read_text(book_id: int) -> str:
    with gzip.open(BOOKS_DIR / f"{book_id}.txt.gz", "rt", encoding="utf-8") as source:
        return source.read()


def recover_suspicious_text(book_id: int, text: str) -> tuple[str, bool]:
    current_words = len(WORD_RE.findall(text))
    if current_words >= 50:
        return text, False
    try:
        prefix = subprocess.run(
            ["git", "-C", str(ROOT), "rev-parse", "--show-prefix"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        blob = subprocess.run(
            ["git", "-C", str(ROOT), "show", f"HEAD:{prefix}public/books/{book_id}.txt.gz"],
            check=True,
            capture_output=True,
        ).stdout
        original = gzip.decompress(blob).decode("utf-8")
    except (OSError, UnicodeDecodeError, subprocess.CalledProcessError):
        original = ""
    if len(WORD_RE.findall(original)) > max(100, current_words * 5):
        return original, True

    release_snapshot = Path("/tmp/yuejian-k12-reading-shallow/public/books") / f"{book_id}.txt.gz"
    if release_snapshot.exists():
        try:
            with gzip.open(release_snapshot, "rt", encoding="utf-8") as source:
                original = source.read()
        except (OSError, UnicodeDecodeError):
            original = ""
        if len(WORD_RE.findall(original)) > max(100, current_words * 5):
            return original, True

    request = urllib.request.Request(
        f"https://www.gutenberg.org/cache/epub/{book_id}/pg{book_id}.txt",
        headers={"User-Agent": "YuejianK12ContentAudit/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            original = response.read().decode("utf-8-sig")
    except (OSError, UnicodeDecodeError, urllib.error.URLError):
        return text, False
    if len(WORD_RE.findall(original)) > max(100, current_words * 5):
        return original, True
    return text, False


def write_text(book_id: int, text: str) -> None:
    path = BOOKS_DIR / f"{book_id}.txt.gz"
    with path.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            zipped.write(text.encode("utf-8"))


def strip_gutenberg_wrapper(text: str) -> tuple[str, bool]:
    changed = False
    start = START_MARKER_RE.search(text)
    if start:
        text = text[start.end():]
        changed = True
    end = END_MARKER_RE.search(text)
    if end:
        text = text[:end.start()]
        changed = True
    return text, changed


def looks_like_wrapped_prose(lines: list[str]) -> bool:
    if len(lines) < 2:
        return False
    lengths = [len(line.strip()) for line in lines if line.strip()]
    if len(lengths) < 2 or statistics.median(lengths) < 48:
        return False
    joined = " ".join(lines)
    if re.search(r"(^|\n)\s{3,}\S", "\n".join(lines)):
        return False
    if sum(1 for char in joined if char.isalpha() and char.isupper()) > max(18, len(joined) * 0.22):
        return False
    return True


def reflow_paragraph(block: str) -> str:
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    if not looks_like_wrapped_prose(lines):
        return "\n".join(lines)
    result = lines[0]
    for line in lines[1:]:
        if result.endswith("-") and line[:1].islower():
            result = result[:-1] + line
        else:
            result += " " + line
    return result


def remove_leading_credits(text: str, _title: str) -> tuple[str, bool]:
    blocks = re.split(r"\n{2,}", text.strip())
    removed = False
    while blocks and re.match(
        r"^\s*(?:produced by|e-?text prepared by|credits?:|transcribed|note:\s*project gutenberg)",
        blocks[0],
        re.IGNORECASE,
    ):
        blocks.pop(0)
        removed = True
    return "\n\n".join(blocks), removed


def normalize_text(text: str, title: str) -> tuple[str, dict]:
    before = text
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ").replace("\t", "    ")
    text, wrapper_removed = strip_gutenberg_wrapper(text)
    text, leading_credits_removed = remove_leading_credits(text, title)
    text = TRAILING_SPACE_RE.sub("", text)

    retained_lines = []
    illustration_placeholders = 0
    for line in text.splitlines():
        if STANDALONE_ART_RE.fullmatch(line):
            illustration_placeholders += 1
        else:
            retained_lines.append(line)
    text = "\n".join(retained_lines)

    blocks = []
    reflowed_blocks = 0
    for block in re.split(r"\n{2,}", text):
        stripped = block.strip()
        if not stripped:
            continue
        reflowed = reflow_paragraph(stripped)
        reflowed_blocks += int(reflowed != stripped)
        blocks.append(reflowed)

    text = "\n\n".join(blocks).strip() + "\n"
    return text, {
        "changed": text != before,
        "wrapperRemoved": wrapper_removed,
        "leadingCreditsRemoved": leading_credits_removed,
        "illustrationPlaceholdersRemoved": illustration_placeholders,
        "reflowedBlocks": reflowed_blocks,
        "replacementCharacters": text.count("\ufffd"),
        "controlCharacters": sum(
            1 for char in text if ord(char) < 32 and char not in "\n\t"
        ),
    }


def reading_profile(book: dict) -> tuple[int, int]:
    start_age_match = re.search(r"\d+", book.get("ageRange", ""))
    start_age = int(start_age_match.group()) if start_age_match else 9
    if start_age <= 4:
        return 120, 90
    if start_age <= 7:
        return 180, 105
    if start_age <= 9:
        return 230, 115
    return 260, 125


books = json.loads(BOOKS_FILE.read_text("utf-8"))
report = {
    "totalBooks": len(books),
    "canonicalReplacements": [],
    "books": [],
}

for target_id, source_id in CANONICAL_TEXTS.items():
    source_text = read_text(source_id)
    write_text(target_id, source_text)
    report["canonicalReplacements"].append({
        "targetGutenbergId": target_id,
        "sourceGutenbergId": source_id,
    })

for index, book in enumerate(books, start=1):
    book_id = int(book["gutenbergId"])
    source_text, recovered = recover_suspicious_text(book_id, read_text(book_id))
    normalized, metrics = normalize_text(source_text, book["title"])
    metrics["recoveredFromCatalogSnapshot"] = recovered
    if metrics["replacementCharacters"] or metrics["controlCharacters"]:
        raise SystemExit(
            f"Text integrity failure for {book_id}: "
            f"{metrics['replacementCharacters']} replacement characters, "
            f"{metrics['controlCharacters']} control characters"
        )

    write_text(book_id, normalized)
    word_count = len(WORD_RE.findall(normalized))
    page_words, words_per_minute = reading_profile(book)
    book["wordCount"] = word_count
    book["pages"] = max(1, math.ceil(word_count / page_words))
    book["minutes"] = max(1, math.ceil(word_count / words_per_minute))

    canonical_id = CANONICAL_TEXTS.get(book_id)
    if canonical_id:
        book["textGutenbergId"] = canonical_id
        book["textSourceUrl"] = f"https://www.gutenberg.org/ebooks/{canonical_id}"
        book["textIntegrityNote"] = (
            f"使用同名完整公版正文 Project Gutenberg #{canonical_id}，"
            "替换目录中的音频清单或节选版本"
        )
    else:
        book["textGutenbergId"] = book_id
        book.setdefault("textSourceUrl", f"https://www.gutenberg.org/ebooks/{book_id}")
        book["textIntegrityNote"] = "已移除公版站说明、空插图占位与异常字符，并保留完整故事正文"

    report["books"].append({
        "gutenbergId": book_id,
        "title": book["title"],
        "wordCount": word_count,
        "pages": book["pages"],
        **metrics,
    })
    print(
        f"[{index:03d}/{len(books)}] {book_id} {book['title']}: "
        f"{word_count:,} words, {book['pages']} pages"
    )

BOOKS_FILE.write_text(
    json.dumps(books, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

REPORT_FILE.parent.mkdir(parents=True, exist_ok=True)
REPORT_FILE.write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)

print(
    "Normalized "
    f"{len(books)} books; "
    f"wrappers removed={sum(item['wrapperRemoved'] for item in report['books'])}; "
    f"placeholders removed={sum(item['illustrationPlaceholdersRemoved'] for item in report['books'])}; "
    f"reflowed blocks={sum(item['reflowedBlocks'] for item in report['books'])}"
)
