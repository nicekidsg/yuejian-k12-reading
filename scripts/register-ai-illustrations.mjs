import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const dataFile = path.join(projectRoot, "src", "data", "gutenberg-books.json");
const books = JSON.parse(await readFile(dataFile, "utf8"));

const generatedIllustrations = new Map([
  [12103, ["/ai-illustrations/12103/01.jpg"]],
  [17089, ["/ai-illustrations/17089/01.jpg"]],
  [23794, ["/ai-illustrations/23794/01.jpg"]],
  [25418, ["/ai-illustrations/25418/01.jpg"]],
  [11757, ["/ai-illustrations/11757/01.jpg"]],
  [1599, ["/ai-illustrations/1599/01.jpg"]],
  [37529, ["/ai-illustrations/37529/01.jpg"]],
  [5727, ["/ai-illustrations/5727/01.jpg"]],
  [10742, ["/ai-illustrations/10742/01.jpg"]],
  [20652, ["/ai-illustrations/20652/01.jpg"]],
  [11592, ["/ai-illustrations/11592/01.jpg"]],
  [13646, ["/ai-illustrations/13646/01.jpg"]],
  [13647, ["/ai-illustrations/13647/01.jpg"]],
  [13648, ["/ai-illustrations/13648/01.jpg"]],
]);

let registered = 0;
const updated = books.map((book) => {
  const aiIllustrations = generatedIllustrations.get(book.gutenbergId)
    || book.aiIllustrations
    || [];
  if (generatedIllustrations.has(book.gutenbergId)) registered += aiIllustrations.length;
  const originalIllustrations = book.originalIllustrations || [];
  const illustrations = [book.cover, ...originalIllustrations, ...aiIllustrations]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  return { ...book, aiIllustrations, illustrations };
});

await writeFile(dataFile, `${JSON.stringify(updated, null, 2)}\n`);
process.stdout.write(`Registered ${registered} AI illustrations across ${generatedIllustrations.size} books.\n`);
