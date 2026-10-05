import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  test(`${theme} local vector illustration and answer trace preserve product boundaries`, async ({ page }) => {
    await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const { calls, scripts } = await stubApi(page); await page.goto("/#vector-lab");
    const vectors = page.locator("#vector-lab");
    await expect(vectors.locator(".demo-vector-point")).toHaveCount(20);
    await expect(vectors).toContainText("Representative projection");
    await vectors.getByRole("button", { name: "KD-tree", exact: true }).click();
    await vectors.getByRole("combobox").selectOption("sample-1");
    await expect(vectors.getByRole("complementary")).toContainText("sample-1");
    await expect(vectors).toContainText("Partition sketch");
    const pipeline = page.locator(".architecture-pipeline");
    await expect(pipeline.locator(".pipeline-selector button")).toHaveText(["01Ask", "02Embed", "03Retrieve", "04Isolate", "05Rerank", "06Generate", "07Cite"]);
    await pipeline.getByRole("button", { name: "04 Isolate" }).click();
    await expect(page.locator("#pipeline-detail")).toContainText("before reranking");
    await expect(page.locator("#pipeline-detail")).toContainText("ready documents");
    await expect(pipeline).toContainText("Example trace");
    await page.getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` }).click();
    await expect(vectors.getByRole("button", { name: "KD-tree", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(pipeline).toHaveAttribute("data-active-stage", "isolate");
    expect(calls).toEqual([]); expectNoProductCode(scripts);
  });

  test(`${theme} architecture reflows with 200% text and visible stage controls`, async ({ page }) => {
    await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    await stubApi(page); await page.goto("/");
    const pipeline = page.locator(".architecture-pipeline");
    await expect(pipeline.locator("[data-pipeline-node]")).toHaveCount(7);
    for (const width of [320, 375, 390, 430, 1024, 1280, 1440]) for (const size of ["100%", "200%"]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, size);
      await pipeline.getByRole("button", { name: "07 Cite" }).click();
      await expect(pipeline).toHaveAttribute("data-active-stage", "cite");
      await expect.poll(() => pipeline.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      expect((await pipeline.getByRole("button", { name: "07 Cite" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const box = (await page.locator("#pipeline-detail").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
      await expect(pipeline.locator("[data-pipeline-node]").first()).toHaveCSS("opacity", "1");
    }
  });
}

test("architecture keyboard selection gives local feedback without changing the tour", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 1440, height: 1000 });
  await stubApi(page); await page.goto("/#architecture");
  const buttons = page.locator(".pipeline-selector button");
  await buttons.first().focus(); await page.keyboard.press("ArrowRight");
  await expect(buttons.nth(1)).toBeFocused(); await expect(buttons.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".machine-console")).toContainText("query_vector");
  await page.keyboard.press("End"); await expect(buttons.last()).toBeFocused();
  await expect(page.locator(".machine-console")).toContainText("sample-16, sample-18");
  await expect(page.locator(".retrieval-canvas")).toHaveAttribute("data-retrieval-stage", "5");
  await page.keyboard.press("Home"); await expect(buttons.first()).toBeFocused();
});

test("technical anchors survive lazy mounting, refresh and browser history", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.setViewportSize({ width: 390, height: 1000 });
  await stubApi(page);
  for (const id of ["vector-lab", "architecture"]) {
    await page.goto(`/#${id}`); const target = page.locator(`#${id}`);
    await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(110);
    await page.reload();
    await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(110);
  }
  await page.getByRole("contentinfo").getByRole("link", { name: "Documents", exact: true }).click();
  await page.goBack(); await expect(page).toHaveURL(/\/#architecture$/);
  await page.goForward(); await expect(page).toHaveURL(/\/#knowledge-documents$/);
});

test("technical entry motion completes once and stays static afterwards", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await page.setViewportSize({ width: 1440, height: 1000 });
  await stubApi(page); await page.goto("/");
  const figure = page.locator(".vector-reveal-figure"); await figure.scrollIntoViewIfNeeded();
  await expect(figure).toHaveCSS("opacity", "1"); await expect(figure).toHaveCSS("transform", "none");
  const selector = page.locator(".pipeline-selector"); await selector.scrollIntoViewIfNeeded();
  for (const node of await selector.locator("[data-pipeline-node]").all()) {
    await expect(node).toHaveCSS("opacity", "1"); await expect(node).toHaveCSS("transform", "none");
  }
  await page.evaluate(() => scrollTo(0, 0));
  for (const node of await selector.locator("[data-pipeline-node]").all()) await expect(node).toHaveCSS("opacity", "1");
});
