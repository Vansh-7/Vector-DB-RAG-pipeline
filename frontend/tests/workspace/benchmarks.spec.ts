import { test, expect, seedSession, SESSION_TOKEN, reply, deferred } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

// Contract-shaped API fixtures exercise presentation; they are not performance claims.
const comparison = {
  algorithms: [
    { name: "hnsw", displayName: "HNSW Graph", latencyMs: .41, throughputQps: 2453, isActive: true },
    { name: "kdtree", displayName: "KD-Tree", latencyMs: 1.25, throughputQps: 800, isActive: false },
    { name: "exact", displayName: "Brute Force (Exact Match)", latencyMs: 2.5, throughputQps: 400, isActive: false },
  ],
  timestamp: "2026-10-05T10:00:00Z",
  topology: [{ level: 0, nodes: 34, edges: 1088 }, { level: 1, nodes: 4, edges: 12 }, { level: 2, nodes: 1, edges: 0 }],
};

async function openBenchmarks(page: import("@playwright/test").Page) {
  await page.goto("/app");
  await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "Vector Lab", exact: true }).click();
  await page.getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Benchmarks", exact: true }).click();
}

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1280, 1024, 390]) {
    test(`${theme} benchmark comparison and topology at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 }); await appearance(page, theme);
      await seedSession(page); await knowledgeApi(page);
      await page.route("**/api/v1/benchmark*", (route) => reply(route, comparison));
      await openBenchmarks(page);
      await expect(page.getByRole("heading", { name: "Compare search algorithms", exact: true })).toBeVisible();
      await expect(page.getByLabel("Test query", { exact: true })).toHaveAttribute("aria-describedby", "benchmark-query-help");
      await expect(page.getByText("5 searches per algorithm · up to 5,000 vectors · in memory", { exact: true })).toBeVisible();
      const results = page.locator('[aria-label="Algorithm comparison results"]');
      await expect(results).toBeVisible();
      await expect(results.getByRole("heading")).toHaveText(["HNSW", "KD-tree", "Exact search"]);
      await expect(results.getByText("Current index", { exact: true })).toHaveCount(1);
      await expect(results.getByRole("article", { name: "HNSW", exact: true })).toContainText("Current index");
      await expect(results.getByText("Avg. latency", { exact: true })).toHaveCount(3);
      await expect(results.getByText("Est. throughput", { exact: true })).toHaveCount(3);
      await expect(results.getByRole("article", { name: "HNSW", exact: true })).toContainText("0.41ms");
      await expect(results.getByRole("article", { name: "HNSW", exact: true })).toContainText("2,453q/s");
      const cards = await results.getByRole("article").all();
      const bounds = await Promise.all(cards.map(async (card) => (await card.boundingBox())!));
      expect(Math.max(...bounds.map((box) => box.width)) - Math.min(...bounds.map((box) => box.width))).toBeLessThan(1);
      if (width >= 768) expect(new Set(bounds.map((box) => box.y)).size).toBe(1);
      else expect(bounds[1].y).toBeGreaterThanOrEqual(bounds[0].y + bounds[0].height);
      const cardPresentation = await results.getByRole("article").evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        const track = element.lastElementChild as HTMLElement;
        const fill = track.firstElementChild as HTMLElement;
        return {
          background: style.backgroundColor, shadow: style.boxShadow,
          radius: parseFloat(style.borderRadius), border: style.borderTopWidth,
          trackHeight: track.getBoundingClientRect().height,
          ratio: fill.getBoundingClientRect().width / track.getBoundingClientRect().width,
        };
      }));
      const canvasRgb = await page.locator(".authenticated-app").evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(canvasRgb).toBe(theme === "dark" ? "rgb(20, 20, 20)" : "rgb(253, 253, 252)");
      for (const [index, card] of cardPresentation.entries()) {
        expect(card.background).not.toBe(canvasRgb);
        expect(card.shadow).toBe("none");
        expect(card.radius).toBeLessThanOrEqual(10);
        expect(card.border).toBe("1px");
        expect(card.trackHeight).toBeGreaterThanOrEqual(3);
        expect(card.trackHeight).toBeLessThanOrEqual(4);
        expect(card.ratio).toBeCloseTo(comparison.algorithms[index].throughputQps / 2453, 2);
      }
      await expect(page.locator('form button[type="submit"]')).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Run again", exact: true })).toHaveCount(1);
      const topology = page.getByRole("region", { name: "HNSW topology" });
      await expect(topology).toContainText("Structure of the benchmark index.");
      const layers = topology.getByRole("article");
      expect(await layers.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))).toEqual(["HNSW layer L2", "HNSW layer L1", "HNSW layer L0"]);
      const base = topology.getByRole("article", { name: "HNSW layer L0", exact: true });
      await expect(base.getByRole("heading", { name: "Base layer", exact: true })).toBeVisible();
      await expect(base.locator("dt")).toHaveText(["Nodes", "Edges"]);
      await expect(base.locator("dd")).toHaveText(["34", "1,088"]);
      await expect(topology.getByRole("heading", { name: "Navigable layer", exact: true })).toHaveCount(2);
      const layerBounds = await Promise.all((await layers.all()).map(async (layer) => (await layer.boundingBox())!));
      expect(Math.max(...layerBounds.map((box) => box.height)) - Math.min(...layerBounds.map((box) => box.height))).toBeLessThan(1);
      if (width >= 1024) expect(new Set(layerBounds.map((box) => box.y)).size).toBe(1);
      else expect(layerBounds[1].y).toBeGreaterThanOrEqual(layerBounds[0].y + layerBounds[0].height);
      const layerPresentation = await layers.evaluateAll((elements) => elements.map((element) => {
        const style = getComputedStyle(element);
        return { shadow: style.boxShadow, border: style.borderTopWidth, padding: style.padding,
          radius: parseFloat(style.borderRadius), background: style.backgroundColor,
          metricFonts: [...element.querySelectorAll("dd")].map((metric) => getComputedStyle(metric).fontFamily) };
      }));
      const panelChannels = await page.locator(".authenticated-app").evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--surface-panel-rgb").trim().split(/\s+/).join(", "));
      for (const layer of layerPresentation) {
        expect(layer.shadow).toBe("none"); expect(layer.border).toBe("1px");
        expect(layer.radius).toBeLessThanOrEqual(12);
        expect(layer.padding).toBe(width >= 640 ? "20px" : "16px");
        expect(layer.background).toBe(`rgb(${panelChannels})`);
        expect(layer.metricFonts.every((font) => font.includes("Geist Mono"))).toBe(true);
      }
      await expect(topology).toContainText("Built for this comparison from your searchable vectors.");
      await expect(page.getByText("Refresh telemetry", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await topology.scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath(`benchmarks-${theme}-${width}.png`) });
      await topology.getByRole("button", { name: "Open Vector Space", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator('[aria-label="Vector Space context"]')).toBeVisible();
    });
  }

  for (const width of [1280, 1440]) {
    test(`${theme} topology fills one balanced row for 1, 2 and 3 layers at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 }); await appearance(page, theme);
      await seedSession(page); await knowledgeApi(page);
      let layerCount = 1;
      await page.route("**/api/v1/benchmark*", (route) => reply(route, { ...comparison, topology: comparison.topology.slice(0, layerCount) }));
      await openBenchmarks(page);
      const topology = page.getByRole("region", { name: "HNSW topology" });
      const layers = topology.getByRole("article");
      for (const count of [1, 2, 3]) {
        if (count > 1) { layerCount = count; await page.getByRole("button", { name: "Run again", exact: true }).click(); }
        await expect(layers).toHaveCount(count);
        expect(await layers.evaluateAll((elements) => elements.map((element) => element.getAttribute("aria-label")))).toEqual(
          Array.from({ length: count }, (_, index) => `HNSW layer L${count - index - 1}`),
        );
        const bounds = await Promise.all((await layers.all()).map(async (layer) => (await layer.boundingBox())!));
        const grid = (await topology.locator(":scope > .grid").boundingBox())!;
        expect(new Set(bounds.map((box) => box.y)).size).toBe(1);
        expect(Math.max(...bounds.map((box) => box.width)) - Math.min(...bounds.map((box) => box.width))).toBeLessThan(1);
        expect(Math.max(...bounds.map((box) => box.height)) - Math.min(...bounds.map((box) => box.height))).toBeLessThan(1);
        expect(bounds[0].x).toBeCloseTo(grid.x, 0);
        expect(bounds.at(-1)!.x + bounds.at(-1)!.width).toBeCloseTo(grid.x + grid.width, 0);
        // All headers, labels and values align across the row, independent of digit count.
        for (const selector of ["h4", "dt:first-child", "dd:first-of-type"]) {
          const baselines = await layers.evaluateAll((elements, selector) => elements.map((element) =>
            element.querySelector(selector)!.getBoundingClientRect().y), selector);
          expect(Math.max(...baselines) - Math.min(...baselines)).toBeLessThan(1);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await topology.scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`topology-${count}-${theme}-${width}.png`) });
      }
    });
  }

  test(`${theme} benchmark query, fallback, busy, retained results, failure and recovery`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    const first = deferred(); const next = deferred();
    const requests: { q: string | null; authorization?: string }[] = [];
    let fail = false; let hold = false;
    await page.route("**/api/v1/benchmark*", async (route) => {
      const request = route.request();
      requests.push({ q: new URL(request.url()).searchParams.get("q"), authorization: request.headers()["authorization"] });
      await first.promise;
      if (hold) await next.promise;
      if (fail) return reply(route, { detail: "Embedding service is unavailable." }, 503);
      await reply(route, comparison);
    });
    await openBenchmarks(page);
    await expect(page.getByRole("status", { name: "Running comparison", exact: true })).toBeVisible();
    const execution = page.locator('form button[type="submit"]');
    await expect(execution).toHaveCount(1);
    await expect(execution).toHaveText("Running…");
    await expect(execution).toBeDisabled();
    await expect(page.getByRole("button", { name: "Run again", exact: true })).toHaveCount(0);
    const runningBounds = (await execution.boundingBox())!;
    const input = page.getByLabel("Test query", { exact: true });
    await input.press("Enter"); await input.press("Enter");
    expect(requests).toHaveLength(1);
    first.resolve();
    const results = page.locator('[aria-label="Algorithm comparison results"]');
    await expect(results).toBeVisible();
    await expect(execution).toHaveText("Run again");
    const readyBounds = (await execution.boundingBox())!;
    expect(readyBounds.x).toBe(runningBounds.x);
    expect(readyBounds.y).toBe(runningBounds.y);
    expect(readyBounds.width).toBe(runningBounds.width);
    expect(requests.every((request) => request.q === null)).toBe(true);
    await input.fill("  How does retrieval work?  "); await input.press("Enter");
    await expect.poll(() => requests.at(-1)?.q).toBe("How does retrieval work?");
    await expect(execution).toHaveText("Run again"); await expect(execution).toBeEnabled();
    hold = true; fail = true;
    await execution.click();
    await expect(execution).toHaveText("Running…"); await expect(execution).toBeDisabled();
    const busyRequests = requests.length;
    await input.press("Enter");
    expect(requests).toHaveLength(busyRequests);
    await expect(results).toBeVisible(); next.resolve();
    await expect(page.getByRole("alert")).toContainText("Embedding service is unavailable.");
    await expect(results).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    await expect(execution).toHaveText("Run again");
    fail = false; await execution.click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(execution).toHaveText("Run again"); await expect(execution).toBeEnabled();
    await input.fill(""); await input.press("Enter");
    // Revisiting the blank query can use its existing 30-second cache; rerun explicitly.
    await expect(execution).toHaveText("Run again"); await expect(execution).toBeEnabled();
    await execution.click();
    await expect.poll(() => requests.at(-1)?.q).toBeNull();
    expect(requests.every((request) => request.authorization === `Bearer ${SESSION_TOKEN}`)).toBe(true);
  });

  test(`${theme} first comparison failure recovers through the same execution control`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    let fail = true;
    await page.route("**/api/v1/benchmark*", (route) => fail
      ? reply(route, { detail: "Embedding service is unavailable." }, 503)
      : reply(route, comparison));
    await openBenchmarks(page);
    const execution = page.locator('form button[type="submit"]');
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(execution).toHaveCount(1); await expect(execution).toHaveText("Run comparison");
    await expect(page.getByRole("button", { name: "Run again", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Retry", exact: true })).toHaveCount(0);
    const before = (await execution.boundingBox())!;
    fail = false;
    await page.getByLabel("Test query", { exact: true }).press("Tab");
    await expect(execution).toBeFocused();
    expect(await execution.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(execution).toHaveText("Run again");
    const after = (await execution.boundingBox())!;
    expect(after).toEqual(before);
  });

  test(`${theme} another current index, absent topology and empty knowledge stay factual`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    await page.route("**/api/v1/status", (route) => reply(route, { engine: "kdtree", metric: "euclidean", total_docs: 34 }));
    let empty = false; let hnsw = false;
    await page.route("**/api/v1/benchmark*", (route) => reply(route, {
      ...comparison, topology: null,
      algorithms: comparison.algorithms.map((algorithm) => ({ ...algorithm,
        isActive: algorithm.name === (hnsw ? "hnsw" : "kdtree"),
        latencyMs: empty ? 0 : algorithm.latencyMs, throughputQps: empty ? 0 : algorithm.throughputQps,
      })),
    }));
    await openBenchmarks(page);
    await expect(page.getByRole("article", { name: "KD-tree", exact: true })).toContainText("Current index");
    const topology = page.getByRole("region", { name: "HNSW topology" });
    await expect(topology).toContainText("Topology is returned when HNSW is the current index.");
    await expect(topology.getByRole("button", { name: "Open Engine", exact: true })).toHaveCount(0);
    hnsw = true; await page.getByRole("button", { name: "Run again", exact: true }).click();
    await expect(topology).toContainText("No topology was produced for this comparison.");
    empty = true; await page.getByRole("button", { name: "Run again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No searchable vectors to benchmark.", exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Algorithm comparison results"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Open Documents", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
  });
}
