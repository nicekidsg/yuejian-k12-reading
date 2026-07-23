const assert = require("node:assert/strict");
const { chromium } = require("/Users/lyxu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:4173/";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Users/lyxu/Library/Caches/ms-playwright/chromium_headless_shell-1148/chrome-mac/headless_shell",
  });
  const page = await browser.newPage({ viewport: { width: 1536, height: 768 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.getByLabel(/搜索 .* 本读物/).fill("The Story of Miss Moppet");
  await page.locator(".catalog-card").first().waitFor();
  await page.locator(".catalog-card-main").first().click();
  await page.getByRole("button", { name: "开始阅读" }).click();
  await page.locator(".reader-scroll pre").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.locator(".reader-text-block").filter({ hasText: "Peter Rabbit" }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !document.querySelector(".vocabulary-panel .tool-loading"));

  const peterCard = page.locator(".vocabulary-card").filter({
    has: page.locator(".vocabulary-word strong", { hasText: /^Peter$/ }),
  });
  await peterCard.waitFor();
  const cardText = await peterCard.innerText();
  assert.match(cardText, /n\. 专有名词/);
  assert.match(cardText, /彼得.*小兔彼得/);
  assert.doesNotMatch(cardText, /逐渐消失|逐渐减少|disciple of Jesus/);
  assert.match(cardText, /阅见少儿语境词库/);
  assert.equal(await peterCard.locator(".vocabulary-source a").count(), 1);

  await peterCard.click();
  assert.ok(await page.locator("mark.reader-word-highlight").count() > 0);
  await page.screenshot({ path: "/tmp/yuejian-peter-fixed.png" });
  await browser.close();
  console.log("vocabulary UI passed: Peter is a highlighted proper name with a child-safe contextual gloss");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
