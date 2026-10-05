// Development-only capture of the actual Vector Lab with authored sample fixtures.
// These helpers are never imported into the public landing page.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";

const destination = resolve(process.argv[2] ?? "test-results/vector-lab-source");
const origin = process.env.CAPTURE_URL ?? "http://127.0.0.1:4176";
await mkdir(destination, { recursive: true });
const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
const { knowledgeApi, appearance } = await vite.ssrLoadModule("/tests/theme/fixtures.ts");
const { seedSession, expectWorkspace } = await vite.ssrLoadModule("/tests/entry/fixtures.ts");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const captures = [];

try {
  for (const theme of ["light", "dark"]) for (const format of ["desktop", "mobile"]) {
    const page = await browser.newPage({ viewport: { width: format === "desktop" ? 1400 : 454, height: format === "desktop" ? 760 : 900 }, reducedMotion: "reduce" });
    await appearance(page, theme, theme);
    await seedSession(page);
    await knowledgeApi(page);
    await page.goto(`${origin}/app`);
    await expectWorkspace(page);
    await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "Vector Lab", exact: true }).click();
    const points = page.locator("circle.data-point");
    await expect(points).toHaveCount(20);
    await page.evaluate(() => document.fonts.ready);
    // Let the actual D3 entrance settle before capturing. No image composition
    // or editing of product states: only crop and lossless source capture.
    await expect.poll(() => points.first().getAttribute("opacity")).toBe("0.85");
    if (format === "desktop") {
      await points.first().click();
      await expect(page.getByRole("complementary", { name: "Vector inspector" }).getByText("sample-1", { exact: true })).toBeVisible();
      await page.mouse.move(0, 0);
      await expect.poll(() => page.locator("circle.active-ring").getAttribute("opacity")).toBe("0.8");
    }
    const target = format === "desktop" ? page.locator("#workspace")
      : page.getByRole("heading", { name: "Vector space", exact: true }).locator("../..");
    const box = await target.boundingBox();
    const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.floor(box.height) };
    const filename = `vector-lab-${format}-${theme}.png`;
    await page.screenshot({ path: resolve(destination, filename), clip, animations: "disabled" });
    captures.push({ filename, width: clip.width, height: clip.height, theme, format });
    await page.close();
  }
  await writeFile(resolve(destination, "capture-manifest.json"), JSON.stringify({
    origin, capturedAt: new Date().toISOString(),
    provenance: "Actual authenticated NeueBit Vector Lab rendered with shared authored API fixtures. Sample coordinates are illustrative, not measured PCA or live backend output.",
    captures,
  }, null, 2) + "\n");
  console.log(JSON.stringify({ destination, captures }));
} finally {
  await browser.close();
  await vite.close();
}
