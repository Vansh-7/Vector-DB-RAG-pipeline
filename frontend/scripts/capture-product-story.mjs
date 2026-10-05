// Development-only capture of the actual product UI with the shared sample fixtures.
// Neither this script nor those fixture/API helpers is imported by the landing page.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";

const destination = resolve(process.argv[2] ?? "test-results/product-story-source");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { knowledgeApi, appearance } = await vite.ssrLoadModule("/tests/theme/fixtures.ts");
const { seedSession, expectWorkspace } = await vite.ssrLoadModule("/tests/entry/fixtures.ts");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];

try {
  for (const theme of ["light", "dark"]) for (const format of ["desktop", "mobile"]) {
    const page = await browser.newPage({ viewport: { width: format === "desktop" ? 1336 : 454, height: 720 }, reducedMotion: "reduce" });
    await appearance(page, theme, theme);
    await seedSession(page);
    await knowledgeApi(page);
    await page.goto(`${origin}/app`);
    await expectWorkspace(page);
    await page.evaluate(() => document.fonts.ready);
    const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
    const workspace = page.locator("#workspace");

    async function capture(view, locator, height, leftCrop = 0) {
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      const box = await locator.boundingBox();
      const clip = { x: Math.round(box.x + leftCrop), y: Math.round(box.y), width: Math.round(box.width - leftCrop), height: Math.round(Math.min(height, box.height)) };
      const filename = `${view}-${format}-${theme}.png`;
      await page.mouse.move(0, 0);
      await page.screenshot({ path: resolve(destination, filename), clip, animations: "disabled" });
      captures.push({ filename, width: clip.width, height: clip.height, theme, format });
    }

    await sidebar.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: "Delete RAG design.md", exact: true }).waitFor();
    await capture("documents", workspace, format === "desktop" ? 450 : 470);

    if (format === "desktop") {
      await page.setViewportSize({ width: 1920, height: 720 });
      await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
    } else {
      // Recent conversations are intentionally absent on mobile. Open the same
      // persisted sample on desktop first, then return to the mobile viewport.
      await page.setViewportSize({ width: 1336, height: 720 });
      await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await page.setViewportSize({ width: 454, height: 720 });
      await expect(sidebar).toHaveCSS("width", "64px");
    }
    if (format === "mobile") await capture("chat", workspace, 686);
    await page.getByRole("button", { name: "2 sources", exact: true }).click();
    const sources = page.getByRole("complementary", { name: "Answer sources", exact: true });
    await sources.waitFor();
    // Crop the actual wide Chat view around its answer and inspector. No UI is
    // rearranged: the wider viewport keeps the inspector from covering the answer.
    const leftCrop = format === "desktop" ? Math.floor((await page.locator(".markdown").boundingBox()).x - (await workspace.boundingBox()).x - 24) : 0;
    if (format === "desktop") await capture("chat", workspace, 686, leftCrop);
    await page.getByRole("button", { name: "Close sources", exact: true }).click();
    if (format === "desktop") await page.setViewportSize({ width: 1336, height: 720 });

    await sidebar.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search your knowledge" }).fill("retrieval");
    await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("region", { name: "Search workspace" }).getByText("2 matches", { exact: true }).waitFor();
    await capture("search", workspace, format === "desktop" ? 530 : 640);
    await page.close();
  }
  await writeFile(resolve(destination, "capture-manifest.json"), JSON.stringify({
    origin, capturedAt: new Date().toISOString(),
    provenance: "Actual authenticated NeueBit UI rendered with the shared authored sample API fixtures. Not live backend output.",
    captures,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures: captures.length }));
} finally {
  await browser.close();
  await vite.close();
}
