import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const books = JSON.parse(await readFile("src/data/gutenberg-books.json", "utf8"));
const summaries = JSON.parse(await readFile("src/data/book-summaries.json", "utf8"));
const audiobooks = JSON.parse(await readFile("src/data/librivox-audiobooks.json", "utf8"));
const coverReport = JSON.parse(await readFile("reports/cover-quality-report.json", "utf8"));
const textReport = JSON.parse(await readFile("reports/text-quality-report.json", "utf8"));
const vocabularyFiles = (await readdir("public/vocabulary")).filter((file) => file.endsWith(".json"));

assert.ok(books.length >= 250 && books.length <= 350, "expected the curated catalog plus the preserved library");
assert.ok(books.filter((book) => book.ageRange === "4–7 岁").length >= 50, "expected at least 50 books for ages 4–7");
assert.equal(vocabularyFiles.length, books.length, "expected one vocabulary file per book");
assert.equal(books.filter((book) => book.catalogSource === "中国儿童英语公版内容库_200本.xlsx").length, 200, "expected all 200 curated spreadsheet rows");
assert.equal(Object.keys(summaries).length, books.length, "expected one bilingual synopsis per book");
assert.equal(coverReport.length, books.length, "expected one audited cover per book");
assert.equal(textReport.books.length, books.length, "expected one audited text per book");
assert.ok(coverReport.every((item) => Math.max(...item.dimensions) >= 720), "every cover must be at least 720p on its long edge");
assert.ok(textReport.books.every((item) => item.replacementCharacters === 0 && item.controlCharacters === 0), "all texts must be free of replacement and control characters");
assert.equal(textReport.canonicalReplacements.length, 3, "expected three incomplete derivative texts to be replaced");

let originalCovers = 0;
let aiAssistedCovers = 0;
let originalIllustrations = 0;
let aiIllustrations = 0;
for (const book of books) {
  assert.ok(book.cover, `${book.title} is missing a cover`);
  assert.ok(book.illustrations?.length > 0, `${book.title} is missing reader imagery`);
  await access(`public${book.cover}`);
  if (book.coverSource?.startsWith("original-edition")) originalCovers += 1;
  if (book.coverSource === "ai-assisted-reconstruction") aiAssistedCovers += 1;
  const summary = summaries[book.gutenbergId];
  assert.ok(summary?.zh?.length >= 30, `${book.title} is missing its Chinese synopsis`);
  assert.ok(summary?.en?.length >= 80, `${book.title} is missing its English synopsis`);
  const text = gunzipSync(await readFile(`public/books/${book.gutenbergId}.txt.gz`)).toString("utf8");
  assert.doesNotMatch(text, /\ufffd|\u0000/, `${book.title} contains invalid text characters`);
  assert.doesNotMatch(text, /^\s*\[(?:illustration|illustrations|frontispiece)\]\s*$/im, `${book.title} contains an empty illustration placeholder`);
  for (const imagePath of book.originalIllustrations || []) {
    await access(`public${imagePath}`);
    originalIllustrations += 1;
  }
  for (const imagePath of book.aiIllustrations || []) {
    await access(`public${imagePath}`);
    aiIllustrations += 1;
  }
}
assert.ok(originalCovers >= 90, "expected broad original-edition cover coverage");
assert.equal(originalCovers + aiAssistedCovers, books.length, "every cover should be an original edition or labeled AI-assisted reconstruction");
assert.ok(aiIllustrations >= 14, "expected generated illustrations for low-age image gaps");

let wordCards = 0;
let phoneticCards = 0;
for (const book of books) {
  const payload = JSON.parse(await readFile(`public/vocabulary/${book.gutenbergId}.json`, "utf8"));
  assert.equal(payload.bookId, `pg-${book.gutenbergId}`);
  assert.equal(payload.total, payload.words.length);
  assert.ok(payload.words.length >= (book.ageRange === "4–7 岁" ? 10 : 250), `${book.title} has too few vocabulary cards`);
  assert.equal(new Set(payload.words.map((entry) => entry.word)).size, payload.words.length, `${book.title} has duplicate vocabulary cards`);
  for (const entry of payload.words) {
    assert.ok(entry.word && entry.translation && entry.pos && entry.level, `${book.title} has an incomplete vocabulary card`);
    assert.match(entry.translation, /[\u3400-\u9fff]/, `${entry.word} lacks a Chinese explanation`);
    assert.doesNotMatch(entry.definition || "", /\b(?:ethnic slur|offensive|disparaging|penis|sexual intercourse|caucasoid race|grown man)\b/i, `${entry.word} has a child-inappropriate definition`);
    wordCards += 1;
    if (entry.phonetic) phoneticCards += 1;
  }
}
assert.ok(phoneticCards / wordCards > 0.82, "phonetic coverage is below 82%");

const audiobookEntries = Object.entries(audiobooks);
assert.ok(audiobookEntries.length >= 85, "expected broad LibriVox coverage");
let tracks = 0;
for (const [gutenbergId, audiobook] of audiobookEntries) {
  assert.ok(books.some((book) => String(book.gutenbergId) === gutenbergId), `unknown audiobook book id ${gutenbergId}`);
  assert.match(audiobook.projectUrl, /^https:\/\/librivox\.org\//);
  assert.ok(audiobook.sections.length > 0, `${audiobook.title} has no sections`);
  for (const section of audiobook.sections) {
    assert.match(section.audioUrl, /^https:\/\/(?:www\.)?archive\.org\//);
    tracks += 1;
  }
}

console.log(`reading data passed: ${books.length} books, ${books.filter((book) => book.ageRange === "4–7 岁").length} for ages 4–7, ${originalCovers} original covers, ${aiAssistedCovers} labeled AI-assisted covers, ${books.length} bilingual summaries, ${originalIllustrations} original interior images, ${aiIllustrations} AI illustrations, ${wordCards} vocabulary cards, ${phoneticCards} phonetics, ${audiobookEntries.length} public audiobooks, ${tracks} audio tracks, ${books.length} TTS-capable books`);
