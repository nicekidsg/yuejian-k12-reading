import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { gunzipSync, gzipSync } from "node:zlib";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const bookDir = path.join(projectRoot, "public", "books");
const coverDir = path.join(projectRoot, "public", "covers");
const dataFile = path.join(projectRoot, "src", "data", "gutenberg-books.json");

const TARGET_BOOKS = 160;
const BASE_BOOKS = 100;
const starts = [1, 26, 51, 76, 101, 126, 151, 176];
const themeLimit = Math.ceil(TARGET_BOOKS / 5);
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
  for (const item of html.matchAll(/<li class="booklink">([\s\S]*?)<\/li>/g)) {
    const body = item[1];
    const id = body.match(/<a class="link" href="\/ebooks\/(\d+)"/)?.[1];
    const cover = body.match(/<img class="cover-thumb" src="([^"]+)"/)?.[1];
    const title = body.match(/<span class="title">([\s\S]*?)<\/span>/)?.[1];
    const author = body.match(/<span class="subtitle">([\s\S]*?)<\/span>/)?.[1];
    const downloads = body.match(/<span class="extra">([\d,]+) downloads<\/span>/)?.[1];
    if (!id || !cover || !title) continue;
    books.push({
      gutenbergId: Number(id),
      coverUrl: `https://www.gutenberg.org${decodeHtml(cover)}`,
      title: decodeHtml(title.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
      author: decodeHtml((author || "Unknown author").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()),
      downloads: Number((downloads || "0").replaceAll(",", "")),
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
  if (matched && counts[matched] < themeLimit) return matched;
  return themes.find(({ id }) => counts[id] < themeLimit)?.id || themes[index % themes.length].id;
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

function normalizedTitle(title) {
  return title.toLowerCase()
    .replace(/ in prose.*$/i, "")
    .split(/[;:]/)[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isLikelyEnglish(text) {
  const tokens = (text.toLowerCase().match(/[a-z]+/g) || []).slice(0, 4_000);
  if (tokens.length < 120) return false;
  const common = new Set(["the", "and", "to", "of", "a", "in", "was", "that", "it", "he", "she", "his", "her", "with", "for", "on", "you", "they", "had"]);
  return tokens.filter((token) => common.has(token)).length / tokens.length >= 0.045;
}

await mkdir(bookDir, { recursive: true });
await mkdir(coverDir, { recursive: true });

async function discoverShelf(shelfId) {
  const pages = [];
  for (const start of starts) {
    const suffix = start === 1 ? "" : `&start_index=${start}`;
    pages.push(await fetchWithRetry(`https://www.gutenberg.org/ebooks/bookshelf/${shelfId}?sort_order=downloads${suffix}`));
  }
  return pages.flatMap(parseShelf);
}

const [childrenBooks, pictureBooks] = await Promise.all([discoverShelf(20), discoverShelf(22)]);
const excludedTitle = /children's literature|\bprimer\b|\breader\b|manual|arithmetic|grammar|encyclop|child(?:ren)?'?s history|geography|biograph|\bverses?\b|\bpoems?\b|\bpoetry\b|\brhymes?\b|\bhymns?\b|\bsongs?\b|uncle remus|hunting of the snark|alice's adventures under ground|sara crewe|\((?:german|french|dutch|spanish|italian|portuguese|swedish|danish|norwegian|finnish|latin)\)/i;
const earlyExcludedTitle = /anti-slavery|\bprimer\b|manual|grammar|geography|biograph|old testament|new testament|bible|catechism|struwwelpeter|max und moritz|household stories by the brothers grimm|uncle remus|old christmas|little black sambo|babes in the wood|great big treasury of beatrix potter|collection of beatrix potter stories|^nonsense books$|twelve labours of hercules|elegy on the death of a mad dog|illustrations to shakespeare|\((?:german|french|dutch|spanish|italian|portuguese|swedish|danish|norwegian|finnish|latin)\)/i;
const textUnavailable = new Set([20037, 20265, 20271, 21526, 21605, 22451, 22787, 23075, 23076, 23717, 23977]);
const counts = Object.fromEntries(themes.map(({ id }) => [id, 0]));
const existing = JSON.parse(await readFile(dataFile, "utf8").catch(() => "[]"));
const pictureMetadata = new Map(pictureBooks.map((book) => [book.gutenbergId, book]));
const results = existing
  .filter((book) => book.ageRange !== "4–7 岁" || !earlyExcludedTitle.test(book.title))
  .map((book) => book.ageRange === "4–7 岁" && pictureMetadata.has(book.gutenbergId)
    ? { ...book, title: pictureMetadata.get(book.gutenbergId).title, author: pictureMetadata.get(book.gutenbergId).author, downloads: pictureMetadata.get(book.gutenbergId).downloads }
    : book)
  .slice(0, TARGET_BOOKS);
for (const book of results) counts[book.themeId] += 1;
const selectedIds = new Set(results.map((book) => book.gutenbergId));
const seenTitles = new Set(results.map((book) => normalizedTitle(book.title)));

function uniqueCandidates(sourceBooks, excluded) {
  return sourceBooks.filter((book) => {
    const titleKey = normalizedTitle(book.title);
    if (selectedIds.has(book.gutenbergId) || textUnavailable.has(book.gutenbergId) || excluded.test(book.title) || seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });
}

async function importUntil(sourceBooks, target, earlyReader) {
  for (const [index, source] of sourceBooks.entries()) {
    if (results.length >= target) break;
    const id = source.gutenbergId;
    const textFile = path.join(bookDir, `${id}.txt.gz`);
    const coverFile = path.join(coverDir, `${id}.jpg`);
    let text;
    try {
      text = gunzipSync(await readFile(textFile)).toString("utf8");
    } catch {
      try {
        const rawText = await fetchFirst([
          `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
          `https://www.gutenberg.org/files/${id}/${id}.txt`,
          `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
        ]);
        text = stripGutenberg(rawText);
        if (text.length < (earlyReader ? 650 : 2_500) || !isLikelyEnglish(text)) throw new Error(`Book ${id} is too short or not English prose`);
        await writeFile(textFile, gzipSync(text, { level: 9 }));
      } catch (error) {
        process.stderr.write(`Skipping ${id}: ${error.message}\n`);
        continue;
      }
    }
    try {
      await readFile(coverFile);
    } catch {
      try {
        const cover = await fetchWithRetry(source.coverUrl, "buffer");
        await writeFile(coverFile, cover);
      } catch (error) {
        process.stderr.write(`Skipping cover for ${id}: ${error.message}\n`);
        continue;
      }
    }

    const themeId = chooseTheme(source, index, counts);
    counts[themeId] += 1;
    const theme = themes.find((item) => item.id === themeId);
    const wordCount = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length || 0;
    const difficulty = earlyReader
      ? { level: "入门", grade: "学龄前–小学低年级", mode: "亲子共读", ageRange: "4–7 岁" }
      : difficultyFor(wordCount);

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
      pages: Math.max(8, Math.round(wordCount / (earlyReader ? 120 : 250))),
      minutes: Math.max(3, Math.round(wordCount / (earlyReader ? 90 : 120))),
      format: earlyReader ? "英文公版低龄绘本" : "英文公版原著",
      ...difficulty,
    });
    selectedIds.add(id);
    process.stdout.write(`[${String(results.length).padStart(3, "0")}/${TARGET_BOOKS}] ${source.title}\n`);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

if (results.length < BASE_BOOKS) await importUntil(uniqueCandidates(childrenBooks, excludedTitle), BASE_BOOKS, false);
if (results.length < TARGET_BOOKS) await importUntil(uniqueCandidates(pictureBooks, earlyExcludedTitle), TARGET_BOOKS, true);
if (results.length !== TARGET_BOOKS) throw new Error(`Imported ${results.length} books instead of ${TARGET_BOOKS}`);
await writeFile(dataFile, `${JSON.stringify(results, null, 2)}\n`);
const selectedFileIds = new Set(results.map((book) => String(book.gutenbergId)));
for (const file of await readdir(bookDir)) {
  if (!selectedFileIds.has(file.split(".")[0])) await unlink(path.join(bookDir, file));
}
for (const file of await readdir(coverDir)) {
  if (!selectedFileIds.has(file.split(".")[0])) await unlink(path.join(coverDir, file));
}
process.stdout.write(`Imported ${results.length} books. Theme counts: ${JSON.stringify(counts)}\n`);
