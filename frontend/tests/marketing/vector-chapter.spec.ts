import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  for (const [width, height] of [[1440, 900], [1366, 768], [1280, 800], [1024, 768], [767, 844], [390, 844]]) {
    test(`${width}x${height} ${theme}: vector context stays grouped without inner scrolling`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height });
      const { calls, scripts } = await stubApi(page); await page.goto("/#vector-lab");
      const chapter = page.locator("#vector-lab"), surface = chapter.locator(".vector-reveal-image");
      await expect(chapter.locator(".demo-vector-point")).toHaveCount(20);
      await expect(chapter.getByRole("complementary")).toContainText("RAG design.md");
      await expect(chapter.getByRole("complementary")).toContainText("sample-16");
      await expect(chapter.getByRole("heading", { name: "Three ways to search the space.", exact: true })).toBeVisible();
      const intro = (await chapter.locator(".vector-reveal-intro").boundingBox())!;
      const window = (await surface.boundingBox())!;
      // The instrument uses the same content rails as the preceding and following chapters.
      for (const container of ["#knowledge-work", "#architecture > .marketing-container"]) {
        const rails = await page.locator(container).evaluate(element => {
          const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
          return { left: rect.left + parseFloat(style.paddingLeft), right: rect.right - parseFloat(style.paddingRight) };
        });
        expect(Math.abs(window.x - rails.left)).toBeLessThan(1);
        expect(Math.abs(window.x + window.width - rails.right)).toBeLessThan(1);
      }
      expect(window.y - intro.y - intro.height).toBeGreaterThanOrEqual(24);
      expect(window.y - intro.y - intro.height).toBeLessThanOrEqual(40);
      const graph = (await chapter.locator(".demo-vector-map").boundingBox())!;
      const inspector = (await chapter.getByRole("complementary").boundingBox())!;
      const legend = (await chapter.locator(".demo-vector-legend").boundingBox())!;
      const selector = (await chapter.getByLabel("Choose a sample vector").boundingBox())!;
      const strategies = (await chapter.locator(".engineering-strategies").boundingBox())!;
      const controls = chapter.getByRole("group", { name: "Choose search engine" });
      const controlBox = (await controls.boundingBox())!;
      const telemetryBox = (await chapter.locator(".demo-telemetry").boundingBox())!;
      expect(Math.abs(controlBox.x - graph.x)).toBeLessThan(1);
      expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(graph.y);
      expect(Math.abs(telemetryBox.x - graph.x)).toBeLessThan(1);
      expect(telemetryBox.y + telemetryBox.height).toBeLessThan(controlBox.y);
      expect(telemetryBox.y + telemetryBox.height).toBeLessThanOrEqual(graph.y);
      expect(await controls.evaluate(element => !!(element.compareDocumentPosition(document.querySelector("#vector-lab .demo-telemetry")!) & Node.DOCUMENT_POSITION_PRECEDING))).toBe(true);
      await expect(chapter.locator(".demo-telemetry")).toHaveText("Vectors 20Metric CosineRepresentative projection");
      for (const button of await controls.getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect(strategies.y - window.y - window.height).toBeGreaterThanOrEqual(24);
      expect(strategies.y - window.y - window.height).toBeLessThanOrEqual(40);
      expect(legend.y).toBeGreaterThanOrEqual(Math.max(graph.y + graph.height, inspector.y + inspector.height));
      expect(Math.abs(legend.x + legend.width - graph.x - graph.width)).toBeLessThan(1);
      expect(Math.abs(selector.x - graph.x)).toBeLessThan(1);
      if (width >= 1024) {
        const selectLabel = (await chapter.locator(".demo-vector-select").boundingBox())!;
        expect(Math.abs(selectLabel.y - legend.y)).toBeLessThan(1);
        expect(selector.x + selector.width).toBeLessThan(legend.x);
      } else {
        expect(selector.y).toBeGreaterThan(legend.y + legend.height);
      }
      await expect(chapter.locator(".demo-vector-legend span").filter({ hasText: "Maths" }).locator("i")).toHaveCSS("background-color", "rgb(250, 204, 21)");
      await expect(chapter.getByRole("button", { name: "Inspect sample-9 from Vector search notes.md", exact: true }).locator("span")).toHaveCSS("background-color", "rgb(250, 204, 21)");
      for (const part of ["dt", "dd"]) {
        const typography = (element: Element) => {
          const style = getComputedStyle(element);
          return { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight, leading: style.lineHeight };
        };
        expect(await chapter.locator(`.engineering-indexes ${part}`).first().evaluate(typography)).toEqual(await page.locator(`.engineering-storage ${part}`).first().evaluate(typography));
      }
      if (width >= 1024) {
        expect(selector.width).toBeGreaterThanOrEqual(320); expect(selector.width).toBeLessThanOrEqual(440);
        expect(selector.width).toBeLessThan(window.width * .5);
        expect(graph.height).toBeGreaterThanOrEqual(300); expect(graph.height).toBeLessThanOrEqual(360);
        expect(Math.abs(graph.y - inspector.y)).toBeLessThan(1);
        expect(inspector.width / (graph.width + inspector.width)).toBeGreaterThanOrEqual(.24);
        expect(inspector.width / (graph.width + inspector.width)).toBeLessThanOrEqual(.29);
        await chapter.locator(".demo-vector-map").evaluate(element => scrollTo(0, element.getBoundingClientRect().top + scrollY - 100));
        expect((await chapter.getByLabel("Choose a sample vector").boundingBox())!.y + selector.height).toBeLessThan(height - 24);
      } else {
        expect(inspector.y).toBeGreaterThanOrEqual(graph.y + graph.height);
        expect(selector.y).toBeGreaterThan(legend.y);
      }
      expect(await chapter.evaluate(element => [...element.querySelectorAll("*")].filter(child => {
        const style = getComputedStyle(child);
        return style.scrollSnapType !== "none"
          || (/(auto|scroll)/.test(style.overflowY) && child.scrollHeight > child.clientHeight + 1)
          || (/(auto|scroll)/.test(style.overflowX) && child.scrollWidth > child.clientWidth + 1);
      }).map(child => child.className))).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]); expect(calls).toEqual([]); expectNoProductCode(scripts);
    });
  }

  test(`${theme}: algorithm explanations and passage inspection follow the local controls`, async ({ page }) => {
    await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1366, height: 768 });
    const { calls } = await stubApi(page); await page.goto("/#vector-lab");
    const chapter = page.locator("#vector-lab");
    for (const [id, name, caption] of [["hnsw", "HNSW", "Graph sketch"], ["kdtree", "KD-tree", "Partition sketch"], ["exact", "Exact", "All sample vectors"]]) {
      await chapter.getByRole("button", { name, exact: true }).click();
      await expect(chapter.locator(`.engineering-indexes > [data-engine="${id}"]`)).toHaveAttribute("data-active", "true");
      await expect(chapter.locator('.engineering-indexes > [data-active="true"]')).toHaveCount(1);
      await expect(chapter.locator(".demo-map-caption")).toHaveText(caption);
    }
    // Every authored passage remains visible; longer inspector copy grows naturally.
    for (let index = 1; index <= 20; index++) {
      await chapter.getByLabel("Choose a sample vector").selectOption(`sample-${index}`);
      await expect(chapter.getByRole("complementary")).toContainText(`sample-${index}`);
      expect(await chapter.getByRole("complementary").evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
    }
    await chapter.getByRole("button", { name: "Inspect sample-16 from RAG design.md", exact: true }).click();
    await expect(chapter.getByLabel("Choose a sample vector")).toHaveValue("sample-16");
    await expect(chapter.getByRole("complementary")).toContainText("Retrieval embeds the question");
    await chapter.getByRole("button", { name: "KD-tree", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(chapter.getByRole("button", { name: "KD-tree", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(chapter.getByRole("button", { name: "KD-tree", exact: true })).toBeFocused();
    await expect(chapter.locator(".engineering-indexes dd")).toHaveText([
      "Follow neighboring vectors instead of comparing every stored vector.",
      "Partition the dimensions and narrow the search region.",
      "Compare against every stored vector as the reference baseline.",
    ]);
    expect(calls).toEqual([]);
  });

  test(`${theme}: enlarged text keeps engineering controls and passage inspection readable`, async ({ page }) => {
    await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    await stubApi(page); await page.goto("/#vector-lab");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    const chapter = page.locator("#vector-lab");
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await chapter.getByRole("button", { name: "Exact", exact: true }).click();
      await chapter.getByLabel("Choose a sample vector").selectOption("sample-16");
      await expect(chapter.getByRole("complementary")).toContainText("Retrieval embeds the question");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await chapter.evaluate(element => [...element.querySelectorAll(".demo-engine-controls, .demo-telemetry, .demo-inspector, .demo-vector-select")].every(child => child.scrollHeight <= child.clientHeight + 1 && child.scrollWidth <= child.clientWidth + 1))).toBe(true);
    }
  });
}
