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
      const topology = page.getByRole("region", { name: "HNSW topology" });
      await expect(topology).toContainText("Structure of the benchmark index.");
      await expect(topology).toContainText("L0 · Base layer");
      await expect(topology).toContainText("34 nodes · 1,088 edges");
      await expect(topology).toContainText("Built for this comparison from your searchable vectors.");
      await expect(page.getByText("Refresh telemetry", { exact: true })).toHaveCount(0);
      await expect(page.getByText("Navigable layer", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`benchmarks-${theme}-${width}.png`) });
      await topology.getByRole("button", { name: "Open Vector Space", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator('[aria-label="Vector Space context"]')).toBeVisible();
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
    await expect(page.getByRole("button", { name: "Running…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Run again", exact: true })).toBeDisabled();
    first.resolve();
    const results = page.locator('[aria-label="Algorithm comparison results"]');
    await expect(results).toBeVisible();
    expect(requests.every((request) => request.q === null)).toBe(true);
    const input = page.getByLabel("Test query", { exact: true });
    await input.fill("  How does retrieval work?  "); await input.press("Enter");
    await expect.poll(() => requests.at(-1)?.q).toBe("How does retrieval work?");
    await expect(page.getByRole("button", { name: "Run comparison", exact: true })).toBeEnabled();
    hold = true; fail = true;
    await page.getByRole("button", { name: "Run again", exact: true }).click();
    await expect(page.getByRole("button", { name: "Running…", exact: true })).toBeDisabled();
    await expect(results).toBeVisible(); next.resolve();
    await expect(page.getByRole("alert")).toContainText("Embedding service is unavailable.");
    await expect(results).toBeVisible();
    fail = false; await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Run comparison", exact: true })).toBeEnabled();
    await input.fill(""); await input.press("Enter");
    // Revisiting the blank query can use its existing 30-second cache; rerun explicitly.
    await expect(page.getByRole("button", { name: "Run comparison", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Run again", exact: true }).click();
    await expect.poll(() => requests.at(-1)?.q).toBeNull();
    expect(requests.every((request) => request.authorization === `Bearer ${SESSION_TOKEN}`)).toBe(true);
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
