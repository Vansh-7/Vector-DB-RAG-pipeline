// Production-build visual review. The public route must not request an API.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const destination = resolve(process.argv[2] ?? "test-results/phase-d-review");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];

async function open(context, theme) {
  await context.addInitScript((value) => localStorage.setItem("neuebit-theme", value), theme);
  const page = await context.newPage();
  await page.route("**/api/v1/**", () => { throw new Error("The public story requested an API"); });
  page.on("pageerror", (error) => { throw error; });
  await page.goto(origin);
  await expect(page.locator(".product-story-step")).toHaveCount(3);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function scrollStep(page, index) {
  await page.locator("[data-story-step]").nth(index).evaluate((element) => {
    window.scrollTo(0, element.getBoundingClientRect().top + scrollY - innerHeight * .35);
  });
}

try {
  for (const theme of ["light", "dark"]) for (const width of [1440, 1280, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce", colorScheme: theme });
    const page = await open(context, theme);
    await expect(page.locator("[data-story-layout]")).toHaveAttribute("data-story-layout", width < 1100 ? "stacked" : "sticky");
    for (let index = 0; index < 3; index++) {
      await scrollStep(page, index);
      const view = ["documents", "chat", "search"][index];
      if (width >= 1100) await expect(page.locator(".product-story-layer[data-active=true]")).toHaveAttribute("data-capture", view);
      const image = width >= 1100 ? page.locator(".product-story-layer[data-active=true] img") : page.locator("[data-story-step]").nth(index).locator("img");
      await expect.poll(() => image.evaluate((image) => image.complete && image.naturalWidth > 0)).toBe(true);
      await image.evaluate((image) => image.decode());
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      if (width === 1440) {
        const filename = `phase-d-story-${view}-${width}-${theme}.png`;
        await page.screenshot({ path: resolve(destination, filename) });
        captures.push(filename);
      }
    }
    if (width >= 1100) await page.getByRole("button", { name: "Show Documents capture" }).evaluate((button) => button.click());
    await page.evaluate(() => scrollTo(0, 0));
    if (width >= 1100) await expect(page.locator(".product-story-layer[data-active=true]")).toHaveAttribute("data-capture", "documents");
    await expect(page.locator(".demo-shell")).toHaveAttribute("data-intro-step", "4");
    const filename = `phase-d-${width}-${theme}.png`;
    await page.screenshot({ path: resolve(destination, filename), fullPage: true });
    captures.push(filename);
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference",
    recordVideo: { dir: resolve(destination, "recordings"), size: { width: 1440, height: 1000 } } });
  const page = await open(context, "light");
  const video = page.video();
  await page.waitForTimeout(4000);
  for (let index = 0; index < 3; index++) {
    await page.locator("[data-story-step]").nth(index).evaluate((element) => {
      window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - innerHeight * .35, behavior: "smooth" });
    });
    await page.waitForTimeout(1500);
  }
  await page.getByRole("link", { name: "Try Chat in the interactive preview" }).click();
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: "2 sources", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("tab", { name: "Search", exact: true }).click();
  await page.waitForTimeout(1000);
  await context.close();
  const videoPath = resolve(destination, "phase-d-motion-review.webm");
  await rename(await video.path(), videoPath);
  await writeFile(resolve(destination, "phase-d-review.json"), JSON.stringify({ origin, capturedAt: new Date().toISOString(), captures, video: videoPath }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures: captures.length, video: videoPath }));
} finally {
  await browser.close();
}
