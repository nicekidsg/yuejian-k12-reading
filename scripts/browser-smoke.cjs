const { chromium } = require("/Users/lyxu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = "http://127.0.0.1:4174/";
const qaDir = path.resolve(__dirname, "..", "qa");
const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, "..", "src/data/gutenberg-books.json"), "utf8"));
const bookCount = catalog.length;
const firstBook = catalog[0];
fs.mkdirSync(qaDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Users/lyxu/Library/Caches/ms-playwright/chromium_headless_shell-1148/chrome-mac/headless_shell",
  });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await context.newPage();
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const assetProbe = await page.evaluate(async () => {
    try {
      const response = await fetch("/books/11.txt");
      return { ok: response.ok, status: response.status, encoding: response.headers.get("content-encoding"), length: (await response.arrayBuffer()).byteLength };
    } catch (error) {
      return { error: error.message };
    }
  });
  assert.equal(assetProbe.ok, true, `book asset probe failed: ${JSON.stringify(assetProbe)}`);
  await page.getByRole("heading", { name: "从一本真正读得完的书开始" }).waitFor();
  assert.deepEqual(await page.locator(".home-stats strong").allTextContents(), ["0", "0", "0", "0%"]);
  assert.equal(await page.locator(".trail-step small").first().textContent(), "0/5 本");
  await page.screenshot({ path: path.join(qaDir, "v3-home-zero.png"), fullPage: true });

  await page.locator(".side-nav").getByRole("button", { name: "探索" }).click();
  await page.getByRole("heading", { name: `${bookCount} 本可直接阅读的英文故事` }).waitFor();
  assert.equal(await page.locator(".catalog-count strong").textContent(), String(bookCount));
  assert.equal(await page.locator(".catalog-card").count(), 20);
  const ageFilter = page.locator(".filter-group").first();
  await ageFilter.getByRole("button", { name: "4–7 岁" }).click();
  assert.equal(Number(await page.locator(".catalog-count strong").textContent()) >= 50, true);
  assert.equal((await page.locator(".catalog-meta").allTextContents()).every((value) => value.includes("4–7 岁")), true);
  await ageFilter.getByRole("button", { name: "全部" }).click();
  assert.equal(await page.locator(".catalog-count strong").textContent(), String(bookCount));

  const firstCard = page.locator(".catalog-card").first();
  await firstCard.locator(".catalog-card-main").click();
  await page.locator(".detail-modal #detail-title").waitFor();
  await page.getByRole("button", { name: "开始阅读" }).click();
  await page.waitForTimeout(1200);
  if (await page.locator(".reader-status h2").filter({ hasText: "暂时无法打开正文" }).count()) {
    throw new Error(`Reader failed: ${await page.locator(".reader-status").innerText()}\n${errors.join("\n")}`);
  }
  await page.locator(".reader-scroll pre").first().waitFor({ state: "visible", timeout: 15000 });
  assert.ok((await page.locator(".reader-scroll article").textContent()).length > 500);
  assert.match(await page.locator(".reader-pagination").innerText(), /第 1 页[\s\S]*共 \d+ 页/);
  await page.waitForFunction(() => !document.querySelector(".vocabulary-panel .tool-loading"));
  assert.match(await page.locator(".vocabulary-count").innerText(), /^\d+\s*个$/);
  assert.equal(await page.locator(".reader-illustration img").count() >= 1, true);
  await page.locator(".reader-scroll").evaluate((element) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * 0.48; });
  await page.waitForFunction(() => Number(document.querySelector(".reader-percent")?.textContent.replace("%", "")) >= 40);
  await page.screenshot({ path: path.join(qaDir, "v3-reader.png") });
  await page.getByRole("button", { name: "关闭阅读器" }).click();

  await firstCard.getByRole("button", { name: new RegExp(`收藏 ${firstBook.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).click();
  await page.locator(".side-nav").getByRole("button", { name: "我的书架" }).click();
  assert.equal(await page.locator(".page-count strong").textContent(), "1");
  assert.match(await page.locator(".shelf-library-main em").textContent(), /已读 \d+%/);
  await page.locator(".shelf-library-main").click();
  await page.locator(".detail-modal").getByRole("button", { name: "继续阅读" }).click();
  await page.locator(".reader-scroll pre").first().waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".reader-scroll").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await page.waitForFunction(() => Number(document.querySelector(".reader-percent")?.textContent.replace("%", "")) >= 95);
  await page.getByRole("button", { name: "关闭阅读器" }).click();
  await page.locator(".side-nav").getByRole("button", { name: "阅读足迹" }).click();
  assert.equal(await page.locator(".page-count strong").textContent(), "1");
  assert.equal(await page.locator(".trail-step").filter({ hasText: firstBook.category }).locator("small").textContent(), "1/5 本");
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual((await page.locator(".home-stats strong").allTextContents()).slice(0, 2), ["1", "1"]);
  await page.locator(".side-nav").getByRole("button", { name: "好友" }).click();
  await page.getByRole("heading", { name: "创建你的好友码" }).waitFor();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const mobilePage = await mobile.newPage();
  mobilePage.on("console", (message) => { if (message.type() === "error") errors.push(`mobile: ${message.text()}`); });
  mobilePage.on("pageerror", (error) => errors.push(`mobile: ${error.message}`));
  await mobilePage.goto(baseUrl, { waitUntil: "networkidle" });
  await mobilePage.evaluate(() => localStorage.clear());
  await mobilePage.reload({ waitUntil: "networkidle" });
  assert.equal(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
  await mobilePage.locator(".mobile-nav").getByRole("button", { name: "探索" }).click();
  await mobilePage.getByRole("heading", { name: `${bookCount} 本可直接阅读的英文故事` }).waitFor();
  await mobilePage.locator(".mobile-nav").getByRole("button", { name: "我的书架" }).click();
  await mobilePage.getByRole("heading", { name: "我的书架" }).waitFor();
  assert.equal(await mobilePage.locator(".page-count strong").textContent(), "0");
  await mobilePage.locator(".mobile-nav").getByRole("button", { name: "阅读足迹" }).click();
  await mobilePage.getByRole("heading", { name: "阅读足迹" }).waitFor();
  assert.equal(await mobilePage.locator(".page-count strong").textContent(), "0");
  await mobilePage.locator(".mobile-nav").getByRole("button", { name: "好友" }).click();
  await mobilePage.getByRole("heading", { name: "创建你的好友码" }).waitFor();
  await mobilePage.screenshot({ path: path.join(qaDir, "v3-mobile-trail-zero.png"), fullPage: true });

  assert.deepEqual(errors, []);
  await browser.close();
  console.log("browser smoke passed: zero state, catalog, illustrated reader, pagination, progress, favorite, completion, star map, persistence, friend tab, mobile tabs");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
