import { copyFile, cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
for (const file of await readdir("dist/client/books")) {
  if (!file.endsWith(".txt.gz")) continue;
  const sourcePath = `dist/client/books/${file}`;
  await writeFile(sourcePath.slice(0, -3), gunzipSync(await readFile(sourcePath)));
  await rm(sourcePath);
}
await copyFile("worker/index.js", "dist/server/index.js");
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
await cp("drizzle", "dist/.openai/drizzle", { recursive: true });
