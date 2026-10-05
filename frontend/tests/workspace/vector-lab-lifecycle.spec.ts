import type { Page } from "@playwright/test";
import { test, expect, seedSession, deferred, reply } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Primary navigation" });
const lab = (page: Page) => page.getByRole("region", { name: "Vector Lab workspace" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Vector inspector" });
const sections = (page: Page) => lab(page).getByRole("navigation", { name: "Vector Lab sections" });

async function searchHandoff(page: Page) {
  await sidebar(page).getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search your knowledge" }).fill("How does retrieval work?");
  await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
  const result = page.locator('[aria-label="Ranked search results"]').getByRole("button").first();
  await result.click();
  const selectedId = await result.locator("span.font-mono").last().innerText();
  await page.getByRole("button", { name: "Show in Vector Lab", exact: true }).click();
  await expect(sections(page).getByRole("button", { name: "Vector Space", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(inspector(page)).toContainText(selectedId);
  await expect(inspector(page)).toContainText("0.10000");
  await expect(inspector(page).getByText("40.000", { exact: true })).toBeVisible();
  await expect(inspector(page).getByText("50.000", { exact: true })).toBeVisible();
  await expect(lab(page).locator(".query-star")).toHaveCount(1);
  return selectedId;
}

async function expectNeutral(page: Page) {
  await expect(inspector(page)).toContainText("Select a point on the canvas or open a Search match here.");
  await expect(inspector(page)).toContainText("Search or ask a question to project a query into vector space.");
  await expect(inspector(page).getByRole("button", { name: "Clear query", exact: true })).toHaveCount(0);
  await expect(inspector(page).getByText(/^Distance /)).toHaveCount(0);
  await expect(lab(page).locator(".query-star, .query-edge")).toHaveCount(0);
  await expect.poll(() => lab(page).locator("circle.data-point").evaluateAll((points) =>
    points.length > 0 && points.every((point) => Number(point.getAttribute("opacity")) === 0.85),
  )).toBe(true);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} Vector Lab inspection lifecycle`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: theme === "light" ? 1280 : 1440, height: 900 });
      await appearance(page, theme);
      await seedSession(page);
    });

    test("Search handoff survives active sidebar clicks; Clear query resets without a data request", async ({ page }) => {
      const api = await knowledgeApi(page);
      await page.goto("/app");
      const selectedId = await searchHandoff(page);
      await sidebar(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
      await expect(inspector(page)).toContainText(selectedId);
      await expect(lab(page).locator(".query-star")).toHaveCount(1);
      const requests = api.calls.filter((call) => call.path !== "/status").length;
      const transform = await lab(page).locator("svg > g").getAttribute("transform");
      await inspector(page).getByRole("button", { name: "Clear query", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expectNeutral(page);
      expect(api.calls.filter((call) => call.path !== "/status")).toHaveLength(requests);
      expect(await lab(page).locator("svg > g").getAttribute("transform")).toBe(transform);
      // Selecting a vector after clearing must not recover a retrieval score.
      const point = lab(page).locator("circle.data-point").filter({ visible: true }).first();
      await point.click({ force: true });
      await expect(inspector(page).getByRole("button", { name: "Clear selection" })).toBeVisible();
      await expect(inspector(page).getByText(/^Distance /)).toHaveCount(0);
    });

    test("Refresh clears Search context while retaining Lab section, Top-K and terminal state", async ({ page }) => {
      const api = await knowledgeApi(page);
      await page.goto("/app");
      // Cached server-backed Chat messages remain mounted across this handoff.
      await page.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await expect(page.getByRole("button", { name: "2 sources" })).toBeVisible();
      await searchHandoff(page);
      await sections(page).getByRole("button", { name: "Engine", exact: true }).click();
      await lab(page).getByRole("spinbutton", { name: "Top K retrieval" }).fill("8");
      await lab(page).getByRole("spinbutton", { name: "Top K retrieval" }).press("Enter");
      await lab(page).getByRole("button", { name: "Open terminal", exact: true }).click();
      const release = deferred();
      await page.route("**/api/v1/status", async (route) => {
        await release.promise;
        await reply(route, { engine: "hnsw", metric: "cosine", total_docs: 20 });
      });
      const samples = api.calls.filter((call) => call.path === "/vectors/sample").length;
      const searches = api.writes.filter((write) => write.path === "/search/text").length;
      const refresh = lab(page).getByRole("button", { name: "Refresh Lab data" });
      await refresh.click();
      await expect(refresh).toBeDisabled();
      release.resolve();
      await expect(refresh).toBeEnabled();
      await expect(sections(page).getByRole("button", { name: "Engine", exact: true })).toHaveAttribute("aria-current", "page");
      await expect(lab(page).getByRole("spinbutton", { name: "Top K retrieval" })).toHaveValue("8");
      await expect(lab(page).getByRole("button", { name: "Close terminal", exact: true })).toBeVisible();
      expect(api.calls.filter((call) => call.path === "/vectors/sample").length).toBeGreaterThan(samples);
      expect(api.writes.filter((write) => write.path === "/search/text")).toHaveLength(searches);
      await sections(page).getByRole("button", { name: "Vector Space", exact: true }).click();
      await expectNeutral(page);
    });

    test("normal sidebar re-entry clears context from Chat, Documents and Search", async ({ page }) => {
      await knowledgeApi(page);
      await page.goto("/app");
      for (const workspace of ["Chat", "Documents", "Search"]) {
        await searchHandoff(page);
        await sidebar(page).getByRole("button", { name: workspace, exact: true }).click();
        await sidebar(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
        await expectNeutral(page);
      }
    });

    test("source handoff preserves the selected vector; Refresh and sidebar re-entry clear it", async ({ page }) => {
      await knowledgeApi(page);
      await page.goto("/app");
      for (const reset of ["refresh", "sidebar"]) {
        await page.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
        await page.getByRole("button", { name: "2 sources" }).click();
        const sources = page.getByRole("complementary", { name: "Answer sources" });
        await sources.getByRole("navigation", { name: "Retrieved sources" }).getByRole("button").nth(1).click();
        const selectedId = await sources.locator("dl div").filter({ has: page.getByText("Vector ID", { exact: true }) }).locator("dd").innerText();
        await sources.getByRole("button", { name: "View in Vector Lab", exact: true }).click();
        await expect(inspector(page)).toContainText(selectedId);
        await expect(inspector(page)).toContainText("0.80000");
        await expect(inspector(page).getByText("40.000", { exact: true })).toBeVisible();
        await expect(lab(page).locator(".query-star")).toHaveCount(1);
        if (reset === "refresh") {
          const refresh = lab(page).getByRole("button", { name: "Refresh Lab data" });
          await refresh.click();
          await expect(refresh).toBeEnabled();
        } else {
          await sidebar(page).getByRole("button", { name: "Documents", exact: true }).click();
          await sidebar(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
        }
        await expectNeutral(page);
      }
    });
  });
}
