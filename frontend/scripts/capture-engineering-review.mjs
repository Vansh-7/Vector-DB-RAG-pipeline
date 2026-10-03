// Review the production public route, rejecting any API request.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const destination = resolve(process.argv[2] ?? "test-results/phase-e-review");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];

async function open(context, theme) {
  await context.addInitScript((value) => localStorage.setItem("neuebit-theme", value), theme);
  const page = await context.newPage();
  await page.route("**/api/v1/**", () => { throw new Error("The public engineering story requested an API"); });
  page.on("pageerror", (error) => { throw error; });
  await page.goto(origin);
  await expect(page.locator("[data-pipeline-node]")).toHaveCount(10);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function settleImage(image) {
  await image.scrollIntoViewIfNeeded();
  await expect.poll(() => image.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
  await image.evaluate((image) => image.decode());
}

async function save(page, filename, options = {}) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.screenshot({ path: resolve(destination, filename), ...options });
  captures.push(filename);
}

try {
  for (const theme of ["light", "dark"]) for (const width of [1440, 1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", colorScheme: theme });
    const page = await open(context, theme);
    for (let index = 0; index < 3; index++) {
      const step = page.locator("[data-story-step]").nth(index);
      await step.scrollIntoViewIfNeeded();
      const image = width >= 1100 ? page.locator(".product-story-layer[data-active=true] img") : step.locator("img");
      await settleImage(image);
    }
    await settleImage(page.locator(".vector-reveal-image img"));
    for (const section of ["vector-lab", "architecture"]) {
      await page.locator(`#${section}`).evaluate((element) => scrollTo(0, element.getBoundingClientRect().top + scrollY - 96));
      await save(page, `phase-e-${section}-${width}-${theme}.png`);
    }
    const engineeringFile = `phase-e-engineering-${width}-${theme}.png`;
    // A sticky header can be painted across the middle of a tall element
    // capture. Hide it only for this section export; viewport/full-page shots
    // retain the real navigation.
    await page.locator(".marketing-engineering").screenshot({ path: resolve(destination, engineeringFile),
      style: ".marketing-header { visibility: hidden !important; }" });
    captures.push(engineeringFile);
    if (width >= 1100) await page.getByRole("button", { name: "Show Documents capture" }).evaluate((button) => button.click());
    await page.evaluate(() => scrollTo(0, 0));
    await save(page, `phase-e-${width}-${theme}.png`, { fullPage: true });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference",
    recordVideo: { dir: resolve(destination, "recordings"), size: { width: 1440, height: 1000 } } });
  const page = await open(context, "dark");
  const video = page.video();
  await page.waitForTimeout(1400);
  await page.locator("#vector-lab").evaluate((element) => scrollTo({ top: element.getBoundingClientRect().top + scrollY - 96, behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await page.locator(".engineering-indexes").evaluate((element) => scrollTo({ top: element.getBoundingClientRect().top + scrollY - 170, behavior: "smooth" }));
  await page.waitForTimeout(1900);
  await page.locator('[data-lane="answering"]').evaluate((element) => scrollTo({ top: element.getBoundingClientRect().top + scrollY - 480, behavior: "smooth" }));
  await page.waitForTimeout(2100);
  await page.getByRole("link", { name: "Explore Vector Lab preview" }).click();
  await page.waitForTimeout(850);
  await page.getByLabel("Choose a sample vector").selectOption("sample-3");
  await page.waitForTimeout(1000);
  await context.close();
  const videoPath = resolve(destination, "phase-e-motion-review.webm");
  await rename(await video.path(), videoPath);
  await writeFile(resolve(destination, "phase-e-review.json"), JSON.stringify({ origin, capturedAt: new Date().toISOString(), captures, video: videoPath }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures: captures.length, video: videoPath }));
} finally {
  await browser.close();
}
