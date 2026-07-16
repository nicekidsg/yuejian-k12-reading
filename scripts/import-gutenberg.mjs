import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const bookDir = path.join(projectRoot, "public", "books");
const coverDir = path.join(projectRoot, "public", "covers");
const dataFile = path.join(projectRoot, "src", "data", "gutenberg-books.json");

const starts = [1, 26, 51, 76, 101, 126, 151];
const themes = [
  { id: "fantasy", name: "奇幻童话", tone: "purple" },
  { id: "adventure", name: "冒险探索", tone: "blue" },
  { id: "animals", name: "动物自然", tone: "mint" },
  { id: "growth", name: "成长伙伴", tone: "green" },
  { id: "world", name: "世界故事", tone: "cyan" },
];

const decodeHtml = (value) => value
  .replaceAll("&amp;", "&")
  .replaceAll("&#39;", "'")
  .replaceAll("&quot;", '"')
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">");

async function fetchWithRetry(url, kind = "text") {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "YuejianK12Reading/1.0 (educational public-domain reader)", Connection: "close" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return kind === "buffer" ? Buffer.from(await response.arrayBuffer()) : await response.text();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 650 * (attempt + 1)));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${lastError?.message}`);
}

async function fetchFirst(urls, kind = "text") {
  let lastError;
  for (const url of urls) {
    try {
      return await fetchWithRetry(url, kind);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function parseShelf(html) {
  const books = [];
  const pattern = /<li class="booklink">[\s\S]*?<a class="link" href="\/ebooks\/(\d+)"[\s\S]*?<img class="cover-thumb" src="([^"]+)"[\s\S]*?<span class="title">([\s\S]*?)<\/span>[\s\S]*?<span class="subtitle">([\s\S]*?)<\/span>[\s\S]*?<span class="extra">([\d,]+) downloads<\/span>[\s\S]*?<\/li>/g;
  for (const match of html.matchAll(pattern)) {
    books.push({
      gutenbergId: Number(match[1]),
      coverUrl: `https://www.gutenberg.org${decodeHtml(match[2])}`,
      title: decodeHtml(match[3].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
      author: decodeHtml(match[4].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
      downloads: Number(match[5].replaceAll(",", "")),
    });
  }
  return books;
}

function chooseTheme(book, index, counts) {
  const title = book.title.toLowerCase();
  const keywordThemes = [
    ["animals", /animal|jungle|rabbit|bear|bird|cat|dog|horse|wolf|fox|mouse|bee|duck|deer|nature|wood|forest|garden|black beauty/],
    ["fantasy", /fairy|wonderland|oz|magic|dragon|peter pan|princess|goblin|looking-glass|neverland|enchanted/],
    ["adventure", /island|adventure|kidnapped|pirate|treasure|robinson|voyage|railway|ship|journey|ranger|scout/],
    ["growth", /school|little women|anne|pollyanna|children|boy|girl|family|friends|daddy-long-legs|heidi|jo's boys/],
    ["world", /tales|stories|arabian|king arthur|myths|legends|christmas|greek|japanese|india|china|aesop/],
  ];
  const matched = keywordThemes.find(([, pattern]) => pattern.test(title))?.[0];
  if (matched && counts[matched] < 20) return matched;
  return themes.find(({ id }) => counts[id] < 20)?.id || themes[index % themes.length].id;
}

function stripGutenberg(text) {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const startMatch = normalized.match(/\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const endMatch = normalized.match(/\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const start = startMatch ? startMatch.index + startMatch[0].length : 0;
  const end = endMatch?.index && endMatch.index > start ? endMatch.index : normalized.length;
  return normalized.slice(start, end).replace(/\n{4,}/g, "\n\n\n").trim();
}

function difficultyFor(wordCount) {
  if (wordCount < 12000) return { level: "入门", grade: "小学中高年级", mode: "轻松读" };
  if (wordCount < 45000) return { level: "进阶", grade: "小学高年级–初中", mode: "轻松读" };
  return { level: "挑战", grade: "初中阶段", mode: "挑战读" };
}

await mkdir(bookDir, { recursive: true });
await mkdir(coverDir, { recursive: true });

const shelfPages = [];
for (const start of starts) {
  const suffix = start === 1 ? "" : `&start_index=${start}`;
  const url = `https://www.gutenberg.org/ebooks/bookshelf/20?sort_order=downloads${suffix}`;
  shelfPages.push(await fetchWithRetry(url));
}

const discovered = shelfPages.flatMap(parseShelf);
const excludedTitle = /children's literature|\bprimer\b|\breader\b|manual|arithmetic|grammar|encyclop|child(?:ren)?'?s history|geography|biograph|\bverses?\b|\bpoems?\b|\bpoetry\b|\brhymes?\b|\bhymns?\b|\bsongs?\b|uncle remus|hunting of the snark|alice's adventures under ground|sara crewe|\((?:german|french|dutch|spanish|italian|portuguese|swedish|danish|norwegian|finnish|latin)\)/i;
const textUnavailable = new Set([20037, 20265, 20271, 21526, 21605, 22451, 22787, 23075, 23076, 23717, 23977]);
const unique = [];
const seenTitles = new Set();
for (const book of discovered) {
  const normalizedTitle = book.title.toLowerCase()
    .replace(/ in prose.*$/i, "")
    .split(/[;:]/)[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (textUnavailable.has(book.gutenbergId) || excludedTitle.test(book.title) || seenTitles.has(normalizedTitle)) continue;
  seenTitles.add(normalizedTitle);
  unique.push(book);
}
if (unique.length < 100) throw new Error(`Expected at least 100 books, found ${unique.length}`);

const counts = Object.fromEntries(themes.map(({ id }) => [id, 0]));
const results = [];

for (const [index, source] of unique.entries()) {
  if (results.length === 100) break;
  const id = source.gutenbergId;
  const textUrl = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  const textFile = path.join(bookDir, `${id}.txt.gz`);
  const coverFile = path.join(coverDir, `${id}.jpg`);
  let text;
  let cover;
  try {
    text = gunzipSync(await readFile(textFile)).toString("utf8");
  } catch {
    try {
      const rawText = await fetchFirst([
        `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
        `https://www.gutenberg.org/files/${id}/${id}.txt`,
        textUrl,
      ]);
      text = stripGutenberg(rawText);
      if (text.length < 2500) throw new Error(`Book ${id} has unexpectedly short text`);
      await writeFile(textFile, gzipSync(text, { level: 9 }));
    } catch (error) {
      process.stderr.write(`Skipping ${id}: ${error.message}\n`);
      continue;
    }
  }
  try {
    cover = await readFile(coverFile);
  } catch {
    cover = await fetchWithRetry(source.coverUrl, "buffer");
    await writeFile(coverFile, cover);
  }

  const themeId = chooseTheme(source, index, counts);
  counts[themeId] += 1;
  const theme = themes.find((item) => item.id === themeId);
  const wordCount = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0;
  const difficulty = difficultyFor(wordCount);
  const readingMinutes = Math.max(5, Math.round(wordCount / 120));

  results.push({
    id: `pg-${id}`,
    gutenbergId: id,
    title: source.title,
    author: source.author || "Unknown author",
    downloads: source.downloads,
    themeId,
    category: theme.name,
    tone: theme.tone,
    cover: `/covers/${id}.jpg`,
    textPath: `/books/${id}.txt.gz`,
    sourceUrl: `https://www.gutenberg.org/ebooks/${id}`,
    wordCount,
    pages: Math.max(8, Math.round(wordCount / 250)),
    minutes: readingMinutes,
    format: "英文公版原著",
    ...difficulty,
  });

  process.stdout.write(`[${String(results.length).padStart(3, "0")}/100] ${source.title}\n`);
  await new Promise((resolve) => setTimeout(resolve, 120));
}

if (results.length !== 100) throw new Error(`Imported ${results.length} books instead of 100`);
await writeFile(dataFile, `${JSON.stringify(results, null, 2)}\n`);
const selectedIds = new Set(results.map((book) => String(book.gutenbergId)));
for (const file of await readdir(bookDir)) {
  if (!selectedIds.has(file.split(".")[0])) await unlink(path.join(bookDir, file));
}
for (const file of await readdir(coverDir)) {
  if (!selectedIds.has(file.split(".")[0])) await unlink(path.join(coverDir, file));
}
process.stdout.write(`Imported ${results.length} books. Theme counts: ${JSON.stringify(counts)}\n`);
