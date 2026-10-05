// Capture the current hierarchy, local interactions and motion against a production preview.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const destination = resolve(process.argv[2] ?? "test-results/guided-tour-review");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];
const errors = [];
async function open(context, theme) {
  await context.addInitScript((value) => localStorage.setItem("neuebit-theme", value), theme);
  const page = await context.newPage();
  await page.route("**/api/v1/**", (route) => { errors.push(`Unexpected public API: ${route.request().url()}`); return route.abort(); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await expect(page.locator("[data-pipeline-node]")).toHaveCount(10);
  await expect(page.locator(".demo-vector-point")).toHaveCount(20);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function save(page, filename, target) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  if (target) await target.screenshot({ path: resolve(destination, filename) });
  else await page.screenshot({ path: resolve(destination, filename), fullPage: true });
  captures.push(filename);
}
try {
  for (const theme of ["light", "dark"]) for (const width of [1440, 1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", colorScheme: theme });
    const page = await open(context, theme);
    await save(page, `landing-${width}-${theme}.png`);
    if (width === 1440) {
      await save(page, `tour-documents-${theme}.png`, page.locator("#product"));
      await page.getByRole("tab", { name: /Find context/ }).click();
      await save(page, `tour-search-${theme}.png`, page.locator("#product"));
      await page.getByRole("tab", { name: /Ask \+ verify/ }).click();
      await page.getByRole("button", { name: "2 sources" }).click();
      await page.getByRole("button", { name: /Source 2/ }).click();
      await page.getByRole("button", { name: /Source 2/ }).evaluate((button) => button.blur());
      await save(page, `tour-chat-sources-${theme}.png`, page.locator("#product"));
      await save(page, `vector-lab-${theme}.png`, page.locator("#vector-lab"));
      await save(page, `architecture-${theme}.png`, page.locator("#architecture"));
    }
    if (width === 390) {
      for (const chapter of ["documents", "search", "chat"]) {
        const target = page.locator(`.tour-chapters article[data-capability="${chapter}"]`);
        if (chapter === "chat") await target.getByRole("button", { name: "2 sources" }).click();
        await save(page, `mobile-${chapter}-${theme}.png`, target);
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.screenshot({ path: resolve(destination, `mobile-menu-200-${theme}.png`) });
      captures.push(`mobile-menu-200-${theme}.png`);
    }
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference",
    recordVideo: { dir: resolve(destination, "recordings"), size: { width: 1440, height: 1000 } } });
  const page = await open(context, "light");
  const video = page.video();
  await page.waitForTimeout(1100);
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Product", exact: true }).click();
  await page.waitForTimeout(900);
  await page.locator(".demo-document-row").nth(1).click();
  await page.waitForTimeout(600);
  await page.getByRole("tab", { name: /Find context/ }).click();
  await page.waitForTimeout(750);
  await page.locator(".demo-result-row").nth(1).click();
  await page.waitForTimeout(650);
  await page.getByRole("tab", { name: /Ask \+ verify/ }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: "2 sources" }).click();
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: /Source 2/ }).click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.waitForTimeout(600);
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Vector Lab" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("combobox", { name: "Choose a sample vector" }).selectOption("sample-7");
  await page.waitForTimeout(650);
  await page.getByRole("link", { name: "See the architecture" }).click();
  await page.waitForTimeout(1800);
  await context.close();
  const videoPath = resolve(destination, "guided-tour-motion.webm");
  await rename(await video.path(), videoPath);
  if (errors.length) throw new Error(errors.join("\n"));
  await writeFile(resolve(destination, "review.json"), JSON.stringify({ origin, capturedAt: new Date().toISOString(), captures, video: videoPath }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures: captures.length, video: videoPath }));
} finally { await browser.close(); }
