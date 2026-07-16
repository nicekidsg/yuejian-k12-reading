import { readFile, writeFile } from "node:fs/promises";

const books = JSON.parse(await readFile(new URL("../src/data/gutenberg-books.json", import.meta.url), "utf8"));
const outputFile = new URL("../src/data/librivox-audiobooks.json", import.meta.url);
const requestedIds = new Set(process.argv.slice(2).map(Number).filter(Number.isFinite));
const existing = JSON.parse(await readFile(outputFile, "utf8").catch(() => "{}"));
const bookIds = new Set(books.map((book) => String(book.gutenbergId)));
const result = requestedIds.size ? Object.fromEntries(Object.entries(existing).filter(([id]) => bookIds.has(id))) : {};
let completed = 0;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\bversion\s*\d*\b|\bvol(?:ume)?\s*\d*\b|\bthe\b|\ban\b|\ba\b/g, " ")
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlePrefix(title) {
  const main = title.split(/[;:\[]/)[0].replace(/\s+/g, " ").trim();
  return main.split(" ").slice(0, 5).join(" ");
}

function similarity(sourceBook, candidate) {
  if (candidate.language !== "English" || !candidate.sections?.some((section) => section.listen_url)) return -1;
  const sourceVolume = sourceBook.title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1];
  const targetVolume = candidate.title.match(/\bvol(?:ume)?\.?\s*(\d+)/i)?.[1];
  if (sourceVolume && targetVolume && sourceVolume !== targetVolume) return -1;
  if (!/\bpart\s*\d+/i.test(sourceBook.title) && /\bpart\s*\d+/i.test(candidate.title)) return -1;
  const source = normalize(sourceBook.title);
  const target = normalize(candidate.title);
  const sourceTokens = new Set(source.split(" ").filter(Boolean));
  const targetTokens = new Set(target.split(" ").filter(Boolean));
  const overlap = [...sourceTokens].filter((token) => targetTokens.has(token)).length;
  const union = new Set([...sourceTokens, ...targetTokens]).size || 1;
  let score = overlap / union;
  if (source === target) score += 0.45;
  else if (source.startsWith(target) || target.startsWith(source)) score += 0.2;
  const authorLastName = normalize(sourceBook.author).split(" ").at(-1);
  if (candidate.authors?.some((author) => normalize(author.last_name) === authorLastName)) score += 0.18;
  if (/abridged/i.test(candidate.title) && !/abridged/i.test(sourceBook.title)) score -= 0.35;
  const readers = new Set(candidate.sections.flatMap((section) => (section.readers || []).map((reader) => reader.reader_id)));
  if (readers.size === 1) score += 0.06;
  return score;
}

async function requestCandidates(prefix) {
  const url = new URL("https://librivox.org/api/feed/audiobooks/");
  url.searchParams.set("title", `^${prefix}`);
  url.searchParams.set("format", "json");
  url.searchParams.set("extended", "1");
  url.searchParams.set("limit", "20");
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25_000), headers: { "User-Agent": "YuejianK12Reading/1.0 public-domain-audio-matcher" } });
      if (response.status === 404) return [];
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json();
      return payload.books || [];
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function findAudiobook(book) {
  const prefix = titlePrefix(book.title);
  const withoutArticle = prefix.replace(/^(?:the|a|an)\s+/i, "");
  const attempts = [prefix, withoutArticle, prefix.split(" ").slice(0, 3).join(" "), withoutArticle.split(" ").slice(0, 3).join(" "), prefix.split(" ").slice(0, 2).join(" "), withoutArticle.split(" ").slice(0, 2).join(" ")]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  let candidates = [];
  for (const query of attempts) {
    try {
      candidates = await requestCandidates(query);
    } catch (error) {
      process.stderr.write(`LibriVox request failed for ${book.title}: ${error.message}\n`);
      return null;
    }
    if (candidates.length) break;
  }
  const scored = candidates.map((candidate) => ({ candidate, score: similarity(book, candidate) })).sort((a, b) => b.score - a.score);
  if (!scored.length || scored[0].score < 0.52) return null;
  const selected = scored[0].candidate;
  return {
    id: selected.id,
    title: selected.title,
    projectUrl: selected.url_librivox,
    totalTime: selected.totaltime,
    narrator: [...new Set(selected.sections.flatMap((section) => (section.readers || []).map((reader) => reader.display_name)))].join("、"),
    sections: selected.sections.filter((section) => section.listen_url).map((section) => ({
      number: Number(section.section_number) || 0,
      title: section.title || `第 ${section.section_number} 章`,
      audioUrl: section.listen_url,
      duration: Number(section.playtime) || 0,
      reader: section.readers?.map((reader) => reader.display_name).join("、") || "LibriVox volunteer",
    })),
  };
}

const queue = books.filter((book) => !requestedIds.size || requestedIds.has(book.gutenbergId));
const total = queue.length;
async function worker() {
  while (queue.length) {
    const book = queue.shift();
    const audiobook = await findAudiobook(book);
    if (audiobook) result[book.gutenbergId] = audiobook;
    else delete result[book.gutenbergId];
    completed += 1;
    process.stdout.write(`[${String(completed).padStart(3, "0")}/${total}] ${audiobook ? `matched ${audiobook.sections.length} tracks` : "TTS fallback"} · ${book.title}\n`);
  }
}

await Promise.all(Array.from({ length: 6 }, () => worker()));
await writeFile(outputFile, `${JSON.stringify(result, null, 2)}\n`);
process.stdout.write(`Matched ${Object.keys(result).length}/${books.length} LibriVox audiobooks; all remaining books use page TTS.\n`);
