import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const books = JSON.parse(await readFile("src/data/gutenberg-books.json", "utf8"));
const audiobooks = JSON.parse(await readFile("src/data/librivox-audiobooks.json", "utf8"));
const vocabularyFiles = (await readdir("public/vocabulary")).filter((file) => file.endsWith(".json"));

assert.equal(books.length, 100, "expected 100 books");
assert.equal(vocabularyFiles.length, 100, "expected one vocabulary file per book");

let wordCards = 0;
let phoneticCards = 0;
for (const book of books) {
  const payload = JSON.parse(await readFile(`public/vocabulary/${book.gutenbergId}.json`, "utf8"));
  assert.equal(payload.bookId, `pg-${book.gutenbergId}`);
  assert.equal(payload.total, payload.words.length);
  assert.ok(payload.words.length >= 250, `${book.title} has too few vocabulary cards`);
  assert.equal(new Set(payload.words.map((entry) => entry.word)).size, payload.words.length, `${book.title} has duplicate vocabulary cards`);
  for (const entry of payload.words) {
    assert.ok(entry.word && entry.translation && entry.pos && entry.level, `${book.title} has an incomplete vocabulary card`);
    assert.match(entry.translation, /[\u3400-\u9fff]/, `${entry.word} lacks a Chinese explanation`);
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

console.log(`reading data passed: ${wordCards} vocabulary cards, ${phoneticCards} phonetics, ${audiobookEntries.length} public audiobooks, ${tracks} audio tracks, 100 TTS-capable books`);
