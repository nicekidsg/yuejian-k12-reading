import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataFile = path.join(projectRoot, "src", "data", "gutenberg-books.json");
const illustrationRoot = path.join(projectRoot, "public", "illustrations");
const books = JSON.parse(await readFile(dataFile, "utf8"));
const requestedIds = new Set(process.argv.slice(2).map(Number).filter(Number.isFinite));
const alternativeIllustratedEditions = new Map([[11, 28885]]);

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function fetchWithRetry(url, binary = false, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "YuejianK12Reading/1.0 (educational public-domain reader)",
          Connection: "close",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return binary ? Buffer.from(await response.arrayBuffer()) : await response.text();
    } catch (error) {
      lastError = error;
      await wait(450 * (attempt + 1));
    }
  }
  throw new Error(`${url}: ${lastError?.message || "request failed"}`);
}

function imageUrls(html, pageUrl) {
  const urls = [];
  const seen = new Set();
  for (const match of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["']/gi)) {
    const url = new URL(match[1], pageUrl);
    if (!/\.(?:jpe?g|png)$/i.test(url.pathname)) continue;
    if (/logo|icon|spacer|button/i.test(url.pathname)) continue;
    const value = url.href;
    if (seen.has(value)) continue;
    seen.add(value);
    urls.push(value);
  }
  return urls;
}

function evenlySample(items, count) {
  if (items.length <= count) return items;
  return Array.from({ length: count }, (_, index) => items[Math.round((index * (items.length - 1)) / (count - 1))]);
}

function imageDimensions(buffer) {
  if (buffer.length > 24 && buffer.toString("ascii", 1, 4) === "PNG") {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  return null;
}

await mkdir(illustrationRoot, { recursive: true });
const updated = [...books];

async function importBook(book, bookIndex) {
  const id = book.gutenbergId;
  const sourceId = alternativeIllustratedEditions.get(id) || id;
  const pageUrl = `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}-images.html`;
  const bookDirectory = path.join(illustrationRoot, String(id));
  const localImages = [];
  const desiredCount = Math.min(8, Math.max(3, Math.ceil(book.wordCount / 6_000)));

  await rm(bookDirectory, { recursive: true, force: true });
  await mkdir(bookDirectory, { recursive: true });

  try {
    const html = await fetchWithRetry(pageUrl);
    const candidates = imageUrls(html, pageUrl).filter((url) => !/cover/i.test(url));
    const selected = evenlySample(candidates, Math.max(0, desiredCount - 1));

    const downloads = await Promise.all(selected.map(async (url, imageIndex) => {
      try {
        const buffer = await fetchWithRetry(url, true, 1);
        if (buffer.length < 4_000 || buffer.length > 2_500_000) return null;
        const dimensions = imageDimensions(buffer);
        if (!dimensions || dimensions.width < 240 || dimensions.height < 180) return null;
        const extension = path.extname(new URL(url).pathname).toLowerCase() === ".png" ? "png" : "jpg";
        const filename = `${String(imageIndex + 1).padStart(2, "0")}.${extension}`;
        await writeFile(path.join(bookDirectory, filename), buffer);
        return `/illustrations/${id}/${filename}`;
      } catch (error) {
        process.stderr.write(`Image skipped for ${id}: ${error.message}\n`);
        return null;
      }
    }));
    localImages.push(...downloads.filter(Boolean));
  } catch (error) {
    process.stderr.write(`Illustrated edition unavailable for ${id}: ${error.message}\n`);
  }

  const illustrations = [book.cover, ...localImages];
  updated[bookIndex] = {
    ...book,
    illustrations,
    illustrationSourceUrl: pageUrl,
  };
  process.stdout.write(`[${String(bookIndex + 1).padStart(3, "0")}/100] ${id}: ${illustrations.length} illustration(s)\n`);
}

let nextBookIndex = 0;
async function runWorker() {
  while (nextBookIndex < books.length) {
    const bookIndex = nextBookIndex;
    nextBookIndex += 1;
    if (requestedIds.size && !requestedIds.has(books[bookIndex].gutenbergId)) continue;
    await importBook(books[bookIndex], bookIndex);
  }
}

await Promise.all(Array.from({ length: 4 }, runWorker));

await writeFile(dataFile, `${JSON.stringify(updated, null, 2)}\n`);
process.stdout.write(`Saved illustration metadata for ${updated.length} books.\n`);
