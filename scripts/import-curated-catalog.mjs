import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const catalogFile = path.join(projectRoot, "src", "data", "curated-catalog.json");
const dataFile = path.join(projectRoot, "src", "data", "gutenberg-books.json");
const bookDir = path.join(projectRoot, "public", "books");
const coverDir = path.join(projectRoot, "public", "covers");

const rawCatalog = JSON.parse(await readFile(catalogFile, "utf8"));
const existing = JSON.parse(await readFile(dataFile, "utf8"));
const existingById = new Map(existing.map((book) => [book.gutenbergId, book]));
const editionOverrides = new Map([
  [
    12702,
    {
      gutenbergId: 14838,
      catalogGutenbergId: 12702,
      sourceUrl: "https://www.gutenberg.org/ebooks/14838",
    },
  ],
  [
    21588,
    {
      textGutenbergId: 270,
      textSourceUrl: "https://www.gutenberg.org/ebooks/270",
    },
  ],
]);
const catalog = rawCatalog.map((item) => ({
  ...item,
  ...editionOverrides.get(item.gutenbergId),
}));

const themes = {
  奇幻童话: { id: "fantasy", tone: "purple" },
  冒险探索: { id: "adventure", tone: "blue" },
  动物自然: { id: "animals", tone: "mint" },
  成长伙伴: { id: "growth", tone: "green" },
  世界故事: { id: "world", tone: "cyan" },
};

const ageProfiles = {
  "4–7 岁": {
    grade: "学龄前–小学低年级",
    mode: "亲子共读",
    pageWords: 120,
    readingSpeed: 90,
    format: "英文公版低龄绘本",
  },
  "7–9 岁": {
    grade: "小学低年级",
    mode: "轻松读",
    pageWords: 180,
    readingSpeed: 105,
    format: "英文公版桥梁读物",
  },
  "9–12 岁": {
    grade: "小学中高年级",
    mode: "进阶读",
    pageWords: 230,
    readingSpeed: 115,
    format: "英文公版章节读物",
  },
  "12 岁以上": {
    grade: "初中及以上",
    mode: "挑战读",
    pageWords: 260,
    readingSpeed: 125,
    format: "英文公版经典原著",
  },
};

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, binary = false, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "YuejianK12Reading/2.0 (educational public-domain reader)",
          Connection: "close",
        },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return binary
        ? Buffer.from(await response.arrayBuffer())
        : await response.text();
    } catch (error) {
      lastError = error;
      await wait(700 * (attempt + 1));
    }
  }
  throw new Error(`${url}: ${lastError?.message || "request failed"}`);
}

async function fetchFirst(urls, binary = false) {
  let lastError;
  for (const url of urls) {
    try {
      return await fetchWithRetry(url, binary);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function stripGutenberg(text) {
  const normalized = text
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replace(/^\uFEFF/, "");
  const startMatch = normalized.match(
    /\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
  );
  const endMatch = normalized.match(
    /\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i,
  );
  const start = startMatch ? startMatch.index + startMatch[0].length : 0;
  const end =
    endMatch?.index && endMatch.index > start
      ? endMatch.index
      : normalized.length;
  return normalized
    .slice(start, end)
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function selectCatalogText(text, item) {
  if (item.gutenbergId !== 21588) return text;
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const start = normalized.lastIndexOf("\nTHE RELUCTANT DRAGON");
  const end = normalized.indexOf("\nA DEPARTURE", start + 1);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error("Could not isolate The Reluctant Dragon from Dream Days");
  }
  return normalized.slice(start, end).trim();
}

function wordCountFor(text) {
  return text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0;
}

function isUsableEnglishText(text) {
  const words = (text.toLowerCase().match(/[a-z]+/g) || []).slice(0, 4_000);
  if (words.length < 45) return false;
  const common = new Set([
    "the",
    "and",
    "to",
    "of",
    "a",
    "in",
    "was",
    "that",
    "it",
    "he",
    "she",
    "his",
    "her",
    "with",
    "for",
    "on",
    "you",
    "they",
    "had",
  ]);
  return words.filter((word) => common.has(word)).length / words.length >= 0.025;
}

async function loadBookText(item) {
  const id = item.gutenbergId;
  const textId = item.textGutenbergId || id;
  const file = path.join(bookDir, `${id}.txt.gz`);
  try {
    return gunzipSync(await readFile(file)).toString("utf8");
  } catch {
    const raw = await fetchFirst([
      `https://www.gutenberg.org/files/${textId}/${textId}-0.txt`,
      `https://www.gutenberg.org/files/${textId}/${textId}.txt`,
      `https://www.gutenberg.org/cache/epub/${textId}/pg${textId}.txt`,
    ]);
    const text = selectCatalogText(stripGutenberg(raw), item);
    if (!isUsableEnglishText(text)) {
      throw new Error(`Project Gutenberg #${id} has no usable English text`);
    }
    await writeFile(file, gzipSync(text, { level: 9 }));
    return text;
  }
}

async function ensureFallbackCover(id, sourceId = id) {
  const file = path.join(coverDir, `${id}.jpg`);
  try {
    await readFile(file);
    return `/covers/${id}.jpg`;
  } catch {
    const cover = await fetchFirst(
      [
        `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
        `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.cover.medium.jpg`,
        `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.cover.small.jpg`,
      ],
      true,
    );
    await writeFile(file, cover);
    return `/covers/${id}.jpg`;
  }
}

await mkdir(bookDir, { recursive: true });
await mkdir(coverDir, { recursive: true });

const imported = new Map();
let cursor = 0;

async function importWorker() {
  while (cursor < catalog.length) {
    const index = cursor;
    cursor += 1;
    const item = catalog[index];
    const id = item.gutenbergId;
    const previous = existingById.get(id);

    try {
      const [text, fallbackCover] = await Promise.all([
        loadBookText(item),
        ensureFallbackCover(id, item.textGutenbergId || id),
      ]);
      const theme = themes[item.category];
      const profile = ageProfiles[item.ageRange];
      if (!theme || !profile) {
        throw new Error(`Unsupported labels for Project Gutenberg #${id}`);
      }
      const wordCount = wordCountFor(text);
      imported.set(id, {
        ...previous,
        id: `pg-${id}`,
        gutenbergId: id,
        title: item.title,
        author: item.author,
        downloads: previous?.downloads || 0,
        themeId: theme.id,
        category: item.category,
        secondaryCategory: item.secondaryCategory,
        tone: theme.tone,
        cover: previous?.cover || fallbackCover,
        coverSource: previous?.coverSource || "gutenberg-derivative",
        coverSourceUrl:
          previous?.coverSourceUrl ||
          `https://www.gutenberg.org/cache/epub/${id}/pg${id}.cover.medium.jpg`,
        textPath: `/books/${id}.txt.gz`,
        sourceUrl: item.sourceUrl,
        textSourceUrl: item.textSourceUrl || item.sourceUrl,
        catalogGutenbergId: item.catalogGutenbergId || id,
        sourcePlatform: item.sourcePlatform,
        wordCount,
        pages: Math.max(4, Math.ceil(wordCount / profile.pageWords)),
        minutes: Math.max(2, Math.ceil(wordCount / profile.readingSpeed)),
        format: profile.format,
        level: item.level,
        grade: profile.grade,
        mode: profile.mode,
        ageRange: item.ageRange,
        contentType: item.contentType,
        priority: item.priority,
        recommendation: item.recommendation,
        readingSuggestion: item.readingSuggestion,
        organizationSuggestion: item.organizationSuggestion,
        readingWarning: item.readingWarning,
        availableFormats: item.availableFormats,
        rightsNote: item.rightsNote,
        catalogSource: "中国儿童英语公版内容库_200本.xlsx",
      });
      process.stdout.write(
        `[${String(index + 1).padStart(3, "0")}/${catalog.length}] ${id} ${item.title}\n`,
      );
    } catch (error) {
      process.stderr.write(`Failed ${id} ${item.title}: ${error.message}\n`);
    }
  }
}

await Promise.all(Array.from({ length: 5 }, importWorker));

const failed = catalog.filter((item) => !imported.has(item.gutenbergId));
if (failed.length) {
  throw new Error(
    `Could not import ${failed.length} curated books: ${failed
      .map((item) => item.gutenbergId)
      .join(", ")}`,
  );
}

const catalogIds = new Set(catalog.map((book) => book.gutenbergId));
const merged = [
  ...catalog.map((item) => imported.get(item.gutenbergId)),
  ...existing.filter((book) => !catalogIds.has(book.gutenbergId)),
];
await writeFile(dataFile, `${JSON.stringify(merged, null, 2)}\n`);
process.stdout.write(
  `Saved ${merged.length} books: ${catalog.length} curated + ${merged.length - catalog.length} preserved.\n`,
);
