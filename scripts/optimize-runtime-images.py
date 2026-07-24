#!/usr/bin/env python3
"""Compress the 280 runtime covers without reducing their audited dimensions."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src" / "data" / "gutenberg-books.json"
REPORT_FILE = ROOT / "reports" / "cover-optimization-report.json"

books = json.loads(BOOKS_FILE.read_text("utf-8"))
cover_report_path = ROOT / "reports" / "cover-quality-report.json"
cover_report = json.loads(cover_report_path.read_text("utf-8"))
cover_report_by_id = {item["gutenbergId"]: item for item in cover_report}
report = []

for book in books:
    path = ROOT / "public" / book["cover"].lstrip("/")
    before = path.stat().st_size
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        dimensions = list(image.size)
        if max(dimensions) < 720:
            raise SystemExit(f"{book['title']} fell below the 720p cover requirement")
        output_path = ROOT / "public" / "covers" / f"{book['gutenbergId']}-display.webp"
        image.save(output_path, "WEBP", quality=82, method=6)
    book["cover"] = f"/covers/{output_path.name}"
    cover_report_by_id[book["gutenbergId"]]["cover"] = book["cover"]
    after = output_path.stat().st_size
    report.append({
        "gutenbergId": book["gutenbergId"],
        "cover": book["cover"],
        "dimensions": dimensions,
        "beforeBytes": before,
        "afterBytes": after,
    })

BOOKS_FILE.write_text(json.dumps(books, ensure_ascii=False, indent=2) + "\n", "utf-8")
cover_report_path.write_text(json.dumps(cover_report, ensure_ascii=False, indent=2) + "\n", "utf-8")
REPORT_FILE.write_text(json.dumps({
    "totalCovers": len(report),
    "beforeBytes": sum(item["beforeBytes"] for item in report),
    "afterBytes": sum(item["afterBytes"] for item in report),
    "covers": report,
}, ensure_ascii=False, indent=2) + "\n", "utf-8")

print(
    f"Optimized {len(report)} covers: "
    f"{sum(item['beforeBytes'] for item in report) / 1024 / 1024:.1f} MiB -> "
    f"{sum(item['afterBytes'] for item in report) / 1024 / 1024:.1f} MiB"
)
