import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";

const books = JSON.parse(await readFile("src/data/gutenberg-books.json", "utf8"));

async function pruneRuntimeImages(directory, routePrefix, allowedPaths) {
  const walk = async (currentDirectory) => {
    const entries = await readdir(currentDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        if ((await readdir(absolutePath)).length === 0) await rm(absolutePath, { recursive: true });
        continue;
      }
      const relativePath = path.relative(directory, absolutePath).split(path.sep).join("/");
      if (!allowedPaths.has(`/${routePrefix}/${relativePath}`)) await rm(absolutePath);
    }
  };
  await walk(directory);
}

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
for (const file of await readdir("dist/client/books")) {
  if (!file.endsWith(".txt.gz")) continue;
  const sourcePath = `dist/client/books/${file}`;
  await writeFile(sourcePath.slice(0, -3), gunzipSync(await readFile(sourcePath)));
  await rm(sourcePath);
}

await rm("dist/client/ai-cover-templates", { recursive: true, force: true });
await pruneRuntimeImages(
  "dist/client/covers",
  "covers",
  new Set(books.map((book) => book.cover)),
);
await pruneRuntimeImages(
  "dist/client/illustrations",
  "illustrations",
  new Set(books.flatMap((book) => book.originalIllustrations || [])),
);
await pruneRuntimeImages(
  "dist/client/ai-illustrations",
  "ai-illustrations",
  new Set(books.flatMap((book) => book.aiIllustrations || [])),
);

await copyFile("worker/index.js", "dist/server/index.js");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
