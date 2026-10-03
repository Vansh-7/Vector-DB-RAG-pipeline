// Review the complete public route against a production preview, without APIs.
import { mkdir, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";

const destination = resolve(process.argv[2] ?? "test-results/phase-f-review");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];

async function open(context, theme) {
  await context.addInitScript((value) => localStorage.setItem("neuebit-theme", value), theme);
  const page = await context.newPage();
  await page.route("**/api/v1/**", () => { throw new Error("The public landing requested an API"); });
  page.on("pageerror", (error) => { throw error; });
  await page.goto(origin);
  await expect(page.getByRole("contentinfo")).toBeAttached();
  await expect(page.locator("[data-pipeline-node]")).toHaveCount(10);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function decode(image) {
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
      await decode(width >= 1100 ? page.locator(".product-story-layer[data-active=true] img") : step.locator("img"));
    }
    await decode(page.locator(".vector-reveal-image img"));
    if (width >= 1100) await page.getByRole("button", { name: "Show Documents capture" }).evaluate((button) => button.click());
    await page.evaluate(() => scrollTo(0, 0));
    await save(page, `phase-f-landing-${width}-${theme}.png`, { fullPage: true });
    await page.locator(".marketing-final-cta").evaluate((element) => {
      const header = document.querySelector(".marketing-header").getBoundingClientRect().height;
      scrollTo(0, element.getBoundingClientRect().top + scrollY - header);
    });
    await save(page, `phase-f-closing-${width}-${theme}.png`);
    if (width === 390) {
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await page.getByRole("button", { name: "Open navigation" }).click();
      await save(page, `phase-f-menu-390-${theme}-200-percent.png`);
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference",
    recordVideo: { dir: resolve(destination, "recordings"), size: { width: 1440, height: 1000 } } });
  const page = await open(context, "light");
  const video = page.video();
  await page.waitForTimeout(1400);
  await page.locator(".marketing-final-cta").evaluate((element) => {
    scrollTo({ top: element.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" });
  });
  await page.waitForTimeout(1800);
  await page.getByRole("navigation", { name: "Footer product navigation" }).getByRole("link", { name: "Search", exact: true }).click();
  await page.waitForTimeout(850);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.waitForTimeout(650);
  await page.locator(".marketing-final-cta").evaluate((element) => {
    scrollTo({ top: element.getBoundingClientRect().top + scrollY - 80, behavior: "smooth" });
  });
  await page.waitForTimeout(1600);
  await page.getByRole("region", { name: "Ask your knowledge." }).getByRole("link", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await page.waitForTimeout(650);
  await context.close();
  const videoPath = resolve(destination, "phase-f-navigation-review.webm");
  await rename(await video.path(), videoPath);
  await writeFile(resolve(destination, "phase-f-review.json"), JSON.stringify({ origin, capturedAt: new Date().toISOString(), captures, video: videoPath }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures: captures.length, video: videoPath }));
} finally {
  await browser.close();
}
