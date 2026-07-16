#!/usr/bin/env python3
"""Build age-banded, book-specific vocabulary cards from the MIT ECDICT CSV."""

import csv
import gzip
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BOOKS_FILE = ROOT / "src" / "data" / "gutenberg-books.json"
OUTPUT_DIR = ROOT / "public" / "vocabulary"
WORD_RE = re.compile(r"[A-Za-z]+(?:['’][A-Za-z]+)?")
PLAIN_WORD_RE = re.compile(r"^[a-z]+(?:'[a-z]+)?$")
STOPWORDS = set("""
the and but for nor yet so because although though while if then than that this these those
with without from into onto over under about above below between through during before after
here there where when what which who whom whose why how
you your yours yourself yourselves our ours ourselves their theirs themselves his her hers herself
him himself its itself they them she he we us i me my mine it a an of to in on at by as or
is am are was were be been being have has had having do does did doing done
say says said saying can could may might must shall should will would
not no yes very more most much many some any all each every both either neither other another
only own same just also even still already again ever never always often sometimes now
don't doesn't didn't can't couldn't won't wouldn't shouldn't isn't aren't wasn't weren't
i'm you're we're they're i've you've we've they've i'll you'll we'll they'll it's that's there's
""".split())


def age_profile(word_count):
    if word_count < 12_000:
        return "7–10 岁", 800, 7_000
    if word_count < 30_000:
        return "8–12 岁", 1_200, 9_000
    if word_count < 60_000:
        return "9–13 岁", 1_800, 13_000
    if word_count < 100_000:
        return "10–14 岁", 2_500, 18_000
    return "12–16 岁", 3_500, 26_000


def number(value):
    try:
        return int(value or 0)
    except ValueError:
        return 0


def clean_translation(value):
    parts = []
    for line in (value or "").replace("\\n", "\n").splitlines():
        line = re.sub(r"^\s*\[(?:网络|Web)\]\s*", "", line).strip()
        if not line or "人名" in line or re.match(r"^\[(?:计|医|化|经|法|植)\]", line):
            continue
        parts.append(line)
        if len(parts) == 2:
            break
    result = "；".join(parts)[:150]
    return result if re.search(r"[\u3400-\u9fff]", result) else ""


def clean_definition(value):
    for line in (value or "").replace("\\n", "\n").splitlines():
        line = line.strip()
        if line:
            return line[:160]
    return ""


def primary_pos(value, translation):
    labels = {"n": "n. 名词", "v": "v. 动词", "a": "adj. 形容词", "j": "adj. 形容词", "r": "adv. 副词", "d": "adv. 副词", "p": "prep. 介词", "c": "conj. 连词"}
    weighted = []
    for item in (value or "").split("/"):
        match = re.match(r"([a-z]):(\d+)", item)
        if match and match.group(1) in labels:
            weighted.append((number(match.group(2)), labels[match.group(1)]))
    if weighted:
        return max(weighted)[1]
    prefix = re.match(r"\s*(n|v|vt|vi|a|adj|adv|prep|conj)\.", translation or "", re.I)
    if not prefix:
        return "重点词"
    fallback = {"n": "n. 名词", "v": "v. 动词", "vt": "vt. 及物动词", "vi": "vi. 不及物动词", "a": "adj. 形容词", "adj": "adj. 形容词", "adv": "adv. 副词", "prep": "prep. 介词", "conj": "conj. 连词"}
    return fallback[prefix.group(1).lower()]


def importance_label(rank, low, high):
    position = (rank - low) / max(1, high - low)
    if position < 0.34:
        return "基础巩固"
    if position < 0.72:
        return "本龄重点"
    return "拓展挑战"


if len(sys.argv) != 2:
    raise SystemExit("Usage: build-vocabulary.py /path/to/ecdict.csv")

dictionary_path = Path(sys.argv[1])
if not dictionary_path.exists():
    raise SystemExit(f"Dictionary file not found: {dictionary_path}")

books = json.loads(BOOKS_FILE.read_text("utf-8"))
book_tokens = {}
needed_words = set()
for book in books:
    text_path = ROOT / "public" / "books" / f"{book['gutenbergId']}.txt.gz"
    with gzip.open(text_path, "rt", encoding="utf-8") as source:
        tokens = Counter(match.group(0).lower().replace("’", "'") for match in WORD_RE.finditer(source.read()))
    book_tokens[book["gutenbergId"]] = tokens
    needed_words.update(tokens)

csv.field_size_limit(sys.maxsize)
dictionary = {}
with dictionary_path.open("r", encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        word = (row.get("word") or "").strip().lower().replace("’", "'")
        if word in STOPWORDS or word not in needed_words or not PLAIN_WORD_RE.fullmatch(word) or not 3 <= len(word) <= 22:
            continue
        translation = clean_translation(row.get("translation"))
        if not translation:
            continue
        ranks = [value for value in (number(row.get("bnc")), number(row.get("frq"))) if value > 0]
        rank = min(ranks) if ranks else 0
        dictionary[word] = {
            "word": word,
            "phonetic": (row.get("phonetic") or "").strip()[:60],
            "translation": translation,
            "definition": clean_definition(row.get("definition")),
            "pos": primary_pos(row.get("pos"), translation),
            "rank": rank,
            "oxford": number(row.get("oxford")) > 0,
            "tags": (row.get("tag") or "").split(),
            "collins": number(row.get("collins")),
        }

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
selected_ids = set()
totals = []
for book in books:
    book_id = book["gutenbergId"]
    selected_ids.add(f"{book_id}.json")
    age_range, low, high = age_profile(book["wordCount"])
    candidates = []
    for word, count in book_tokens[book_id].items():
        entry = dictionary.get(word)
        if not entry:
            continue
        rank = entry["rank"]
        signaled = entry["oxford"] or entry["collins"] > 0 or any(tag in {"zk", "gk", "cet4"} for tag in entry["tags"])
        if rank:
            if rank < low or rank > high:
                continue
        elif not signaled:
            continue
        effective_rank = rank or min(high, low + (high - low) * 2 // 3)
        score = count * 12 + entry["collins"] * 8 + (18 if entry["oxford"] else 0)
        score += 10 if "zk" in entry["tags"] else 0
        candidates.append({
            "word": word,
            "phonetic": entry["phonetic"],
            "translation": entry["translation"],
            "definition": entry["definition"],
            "pos": entry["pos"],
            "level": importance_label(effective_rank, low, high),
            "frequency": count,
            "score": score,
        })
    candidates.sort(key=lambda item: (-item["score"], item["word"]))
    words = [{key: value for key, value in item.items() if key != "score"} for item in candidates[:900]]
    payload = {
        "bookId": f"pg-{book_id}",
        "ageRange": age_range,
        "selection": f"按 {age_range} 阅读者的常用词频与中小学词汇标记筛选",
        "total": len(words),
        "words": words,
    }
    (OUTPUT_DIR / f"{book_id}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), "utf-8")
    totals.append(len(words))
    print(f"[{len(totals):03d}/100] {book['title']}: {len(words)} words")

for path in OUTPUT_DIR.glob("*.json"):
    if path.name not in selected_ids:
        path.unlink()

print(f"Built {len(totals)} vocabulary files; min={min(totals)}, max={max(totals)}, average={sum(totals) // len(totals)}")
