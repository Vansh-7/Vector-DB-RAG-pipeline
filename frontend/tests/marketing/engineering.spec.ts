import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`${theme} engineering has an independent local vector illustration and separate retrieval paths`, async ({ page }) => {
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { calls, scripts } = await stubApi(page);
    await page.goto("/#vector-lab");
    const section = page.locator("#vector-lab");
    await expect(section.locator(".demo-vector-point")).toHaveCount(20);
    await expect(section).toContainText("Illustrative projection. No live engine.");
    await expect(section.locator(".engineering-indexes").getByRole("definition")).toHaveCount(3);
    await section.getByRole("button", { name: "KD-tree", exact: true }).click();
    await section.getByRole("combobox", { name: "Choose a sample vector" }).selectOption("sample-1");
    await expect(section.getByRole("complementary")).toContainText("sample-1");
    await expect(section).toContainText("Partition sketch");
    const pipeline = page.locator(".architecture-pipeline");
    await expect(pipeline.getByRole("list", { name: "Indexing" }).getByRole("heading", { level: 4 })).toHaveText(["Documents", "Chunking", "Embeddings", "Vector DB"]);
    await expect(pipeline.getByRole("list", { name: "Answering" }).getByRole("heading", { level: 4 })).toHaveText(["Question", "Vector search", "Tenant filter", "Reranking", "LLM", "Answer + sources"]);
    await expect(pipeline).toContainText("Owner + ready documents");
    await expect(page.locator("#architecture")).toContainText("Vectors live in Neuebit’s custom index.");
    await expect(page.locator(".marketing-engineering")).toHaveCSS("background-color", theme === "light" ? "rgb(247, 247, 245)" : "rgb(13, 14, 16)");
    await page.getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` }).click();
    await expect(section.getByRole("button", { name: "KD-tree", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(section.getByRole("complementary")).toContainText("sample-1");
    expect(calls).toEqual([]); expectNoProductCode(scripts);
  });

  test(`${theme} engineering reflows at compact widths and 200% text without hidden content`, async ({ page }) => {
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubApi(page);
    await page.goto("/");
    const diagram = page.getByRole("list", { name: "Answering" });
    await expect(diagram.getByRole("listitem")).toHaveCount(6);
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("#vector-lab").scrollIntoViewIfNeeded();
      await expect(diagram).toHaveCSS("grid-auto-flow", width >= 1024 ? "column" : "row");
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const node of await page.locator("[data-pipeline-node]").all()) {
        await expect(node).toHaveCSS("opacity", "1");
        await expect(node).toHaveCSS("transform", "none");
      }
    }
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect(diagram).toHaveCSS("grid-auto-flow", "row");
      const bounds = await diagram.getByRole("listitem").evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect(); return { x: box.x, right: box.right, width: box.width };
      }));
      expect(bounds.every((box) => box.x >= 0 && box.right <= width && box.width > 100)).toBe(true);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const link of await page.locator(".engineering-actions a").all()) expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.evaluate(() => { document.documentElement.style.fontSize = ""; });
    }
  });
}

test("technical navigation moves focus locally to the architecture", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 1000 });
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#public-mobile-links").getByRole("link", { name: "Vector Lab" }).click();
  await expect(page.locator("#vector-lab")).toBeFocused();
  await expect(page).toHaveURL(/\/#vector-lab$/);
  await page.keyboard.press("Tab");
  const link = page.getByRole("link", { name: "See the architecture" });
  await expect(link).toBeFocused();
  await expect(link).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page.locator("#architecture")).toBeFocused();
  await expect(page).toHaveURL(/\/#architecture$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/#vector-lab$/);
  expect(calls).toEqual([]); expectNoProductCode(scripts);
});

test("direct technical anchors survive lazy mounting, refresh, and browser history", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 1000 });
  await stubApi(page);
  for (const id of ["vector-lab", "architecture"]) {
    await page.goto(`/#${id}`);
    const section = page.locator(`#${id}`);
    await expect.poll(() => section.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(110);
    await expect.poll(() => section.evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    await page.reload();
    await expect.poll(() => section.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(110);
  }
  await page.getByRole("contentinfo").getByRole("link", { name: "Documents", exact: true }).click();
  await page.goBack();
  await expect(page).toHaveURL(/\/#architecture$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.goForward();
  await expect(page).toHaveURL(/\/#product$/);
});

test("architecture reveals nodes and connectors once in reading order", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => {
    const readings: Record<string, number> = {};
    (window as unknown as { pipelineReadings: typeof readings }).pipelineReadings = readings;
    function sample() {
      const parts = document.querySelectorAll<HTMLElement>('[data-lane="answering"] [data-pipeline-node], [data-lane="answering"] .architecture-connector');
      let settled = parts.length === 11;
      parts.forEach((part, index) => {
        const opacity = Number(getComputedStyle(part).opacity);
        if (opacity > .001 && readings[index] === undefined) readings[index] = performance.now();
        settled &&= opacity === 1;
      });
      if (!settled) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await stubApi(page);
  await page.goto("/");
  const heading = page.locator(".vector-reveal-intro").locator("div").first();
  await heading.scrollIntoViewIfNeeded();
  await expect(heading).toHaveCSS("opacity", "1");
  const figure = page.locator(".vector-reveal-figure");
  await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveCSS("opacity", "1");
  await expect(figure).toHaveCSS("transform", "none");
  const lane = page.locator('[data-lane="answering"]');
  await lane.scrollIntoViewIfNeeded();
  for (const node of await lane.locator("[data-pipeline-node], .architecture-connector").all()) await expect(node).toHaveCSS("opacity", "1");
  const readings = await page.evaluate(() => (window as unknown as { pipelineReadings: Record<string, number> }).pipelineReadings);
  await testInfo.attach("pipeline-motion", { body: JSON.stringify(readings, null, 2), contentType: "application/json" });
  const times = Object.values(readings);
  expect(times).toHaveLength(11);
  expect(times.every((time, index) => index === 0 || time >= times[index - 1])).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  for (const node of await lane.locator("[data-pipeline-node]").all()) await expect(node).toHaveCSS("opacity", "1");
  await lane.scrollIntoViewIfNeeded();
  for (const node of await lane.locator("[data-pipeline-node]").all()) await expect(node).toHaveCSS("transform", "none");
});
