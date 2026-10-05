import type { Page } from "@playwright/test";
import { test, expect, seedSession, SESSION_TOKEN, USER, deferred, reply } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";
import { demoChunks } from "../../src/components/marketing/demo/demoContent";

const firstQuestion = "How are passages retained for an answer?";
const secondQuestion = "What happens during document indexing?";
const date = "2026-10-05T10:00:00Z";
const sources = demoChunks.slice(0, 3).map((chunk, index) => ({
  vectorId: chunk.id, category: chunk.category, snippet: chunk.text, score: .75 - index * .12, documentId: 1,
}));
const history = [
  { id: 1, role: "user", content: firstQuestion, sources: null },
  { id: 2, role: "assistant", content: "The first answer cites these passages.", sources: sources.slice(0, 2) },
  { id: 3, role: "user", content: secondQuestion, sources: null },
  { id: 4, role: "assistant", content: "The second answer cites another passage.", sources: [sources[2]] },
].map((message) => ({ ...message, conversation_id: 7, created_at: date }));
const lab = (page: Page) => page.getByRole("region", { name: "Vector Lab workspace" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Vector inspector" });
const navigation = (page: Page) => page.getByRole("navigation", { name: "Primary navigation" });

async function openConversation(page: Page) {
  await page.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
  await expect(page.getByRole("button", { name: "2 sources", exact: true })).toBeVisible();
}

async function sourceHandoff(page: Page, answer = 0, source = 0) {
  await page.getByRole("region", { name: "Chat workspace" }).getByRole("button", { name: /^\d+ sources?$/ }).nth(answer).click();
  const pane = page.getByRole("complementary", { name: "Answer sources" });
  if (await pane.getByRole("navigation", { name: "Retrieved sources" }).count()) {
    await pane.getByRole("navigation", { name: "Retrieved sources" }).getByRole("button").nth(source).click();
  }
  const id = await pane.locator("dl div").filter({ has: page.getByText("Vector ID", { exact: true }) }).locator("dd").innerText();
  const score = await pane.locator("dl div").filter({ has: page.getByText("Retrieval score", { exact: true }) }).locator("dd").innerText();
  await pane.getByRole("button", { name: "View in Vector Lab", exact: true }).click();
  await expect(lab(page)).toBeVisible();
  await expect(inspector(page)).toContainText(id);
  await expect(inspector(page)).toContainText(Number(score).toFixed(5));
  return id;
}

async function expectProjection(page: Page, query: string, x: number, y: number) {
  await expect(inspector(page).getByText(query, { exact: true })).toBeVisible();
  await expect(inspector(page).getByText(x.toFixed(3), { exact: true })).toBeVisible();
  await expect(inspector(page).getByText(y.toFixed(3), { exact: true })).toBeVisible();
  await expect(lab(page).locator(".query-star")).toHaveCount(1);
}

async function expectNeutral(page: Page) {
  await expect(lab(page).locator(".query-star, .query-edge")).toHaveCount(0);
  await expect(inspector(page)).toContainText("Search or ask a question to project a query into vector space.");
  await expect(inspector(page).getByRole("button", { name: "Clear query", exact: true })).toHaveCount(0);
  await expect(inspector(page).getByText(/^Distance /)).toHaveCount(0);
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} source query projection`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: theme === "light" ? 1280 : 1440, height: 900 });
      await appearance(page, theme); await seedSession(page);
    });

    test("reloaded multi-turn history uses each answer's question and original selected citation", async ({ page }) => {
      await knowledgeApi(page);
      await page.route("**/api/v1/conversations/7/messages", (route) => reply(route, history));
      const requests: { text: string; k: number }[] = [];
      await page.route("**/api/v1/search/text", async (route) => {
        expect(route.request().headers().authorization).toBe(`Bearer ${SESSION_TOKEN}`);
        const body = route.request().postDataJSON(); requests.push(body);
        await reply(route, { query_2d: body.text === firstQuestion ? [40, 50] : [60, 70], query_vector: [1],
          results: [{ id: "fresh-search-result", distance: .001, metadata: "Not the citation", category: "TECH", document_id: null }] });
      });
      await page.goto("/app"); await openConversation(page);
      await page.reload(); await openConversation(page);
      for (const [answer, source, query, x, y] of [[0, 0, firstQuestion, 40, 50], [0, 1, firstQuestion, 40, 50], [1, 0, secondQuestion, 60, 70]] as const) {
        const id = await sourceHandoff(page, answer, source);
        await expectProjection(page, query, x, y);
        expect(requests.at(-1)).toEqual({ text: query, k: 5 });
        await expect(inspector(page)).not.toContainText("fresh-search-result");
        await expect.poll(() => lab(page).locator("circle.data-point[opacity='1']").count()).toBe(1);
        const edge = lab(page).locator(".query-edge");
        await expect(edge).toHaveCount(1);
        const chunk = demoChunks.find((chunk) => chunk.id === id)!;
        await expect(edge).toHaveAttribute("x2", String(chunk.position[0]));
        await expect(edge).toHaveAttribute("y2", String(chunk.position[1]));
        await navigation(page).getByRole("button", { name: "Chat", exact: true }).click();
      }
      await page.getByRole("button", { name: "Expand terminal" }).click();
      await expect(page.getByRole("region", { name: "Terminal", exact: true })).not.toContainText("Searching for:");
    });

    test("live answer handoff clears the previous stream projection while reconstructing its question", async ({ page }) => {
      await knowledgeApi(page);
      const release = deferred();
      await page.route("**/api/v1/ask", async (route) => {
        const question = route.request().postDataJSON().question;
        await page.route("**/api/v1/conversations/7/messages", (messagesRoute) => reply(messagesRoute, [
          ...history, { id: 5, conversation_id: 7, role: "user", content: question, sources: null, created_at: date },
          { id: 6, conversation_id: 7, role: "assistant", content: "A live answer.", sources: [sources[0]], created_at: date },
        ]));
        await route.fulfill({ status: 200, contentType: "application/x-ndjson", headers: { "access-control-allow-origin": "*" },
          body: [{ type: "conversation", data: { id: 7, title: "How does retrieval work?" } },
            { type: "query_2d", data: [11, 12] }, { type: "sources", data: [sources[0]] }, { type: "token", data: "A live answer." }]
            .map((event) => JSON.stringify(event)).join("\n") + "\n" });
      });
      await page.route("**/api/v1/search/text", async (route) => {
        expect(route.request().postDataJSON().text).toBe("Explain the new answer");
        await release.promise; await reply(route, { query_2d: [40, 50], results: [] });
      });
      await page.goto("/app");
      await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).fill("Explain the new answer");
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await expect(page.getByText("A live answer.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Send message", exact: true })).toBeDisabled();
      await sourceHandoff(page, 2);
      await expect(inspector(page)).toContainText("Projecting question…");
      await expect(lab(page).locator(".query-star")).toHaveCount(0);
      release.resolve(); await expectProjection(page, "Explain the new answer", 40, 50);
    });

    test("a cited vector outside the sample still has a query star and inspection context", async ({ page }) => {
      await knowledgeApi(page);
      await page.route("**/api/v1/conversations/7/messages", (route) => reply(route, [history[0], {
        ...history[1], sources: [{ ...sources[0], vectorId: "outside-current-sample" }],
      }]));
      await page.goto("/app");
      await page.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await sourceHandoff(page);
      await expectProjection(page, firstQuestion, 40, 50);
      await expect(inspector(page)).toContainText("This vector is outside the current visualization sample.");
      await expect(lab(page).locator(".query-edge")).toHaveCount(0);
    });

    for (const outcome of ["failure", "no coordinates"] as const) {
      test(`${outcome} keeps the original source highlighted and lets Clear query reset it`, async ({ page }) => {
        await knowledgeApi(page);
        await page.route("**/api/v1/search/text", (route) => outcome === "failure"
          ? reply(route, { detail: "Projection service unavailable" }, 503) : reply(route, { query_2d: null, results: [] }));
        await page.goto("/app"); await openConversation(page);
        await sourceHandoff(page);
        await expect(inspector(page)).toContainText("Query projection unavailable.");
        await expect(lab(page).locator(".query-star")).toHaveCount(0);
        await expect.poll(() => lab(page).locator("circle.data-point[opacity='1']").count()).toBe(1);
        await inspector(page).getByRole("button", { name: "Clear query", exact: true }).click();
        await expectNeutral(page);
      });
    }

    for (const reset of ["Refresh", "Clear query", "sidebar entry"] as const) {
      test(`${reset} during a pending handoff cannot resurrect the query`, async ({ page }) => {
        await knowledgeApi(page);
        const release = deferred(); let projections = 0;
        await page.route("**/api/v1/search/text", async (route) => {
          projections++; await release.promise; await reply(route, { query_2d: [40, 50], results: [] });
        });
        await page.goto("/app"); await openConversation(page); await sourceHandoff(page);
        await expect(inspector(page)).toContainText("Projecting question…");
        await expect.poll(() => projections).toBe(1);
        if (reset === "Refresh") {
          await lab(page).getByRole("button", { name: "Refresh Lab data" }).click();
          await expect(lab(page).getByRole("button", { name: "Refresh Lab data" })).toBeEnabled();
        } else if (reset === "Clear query") {
          await inspector(page).getByRole("button", { name: "Clear query", exact: true }).click();
        } else {
          await navigation(page).getByRole("button", { name: "Documents", exact: true }).click();
          await navigation(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
        }
        release.resolve();
        await page.unrouteAll({ behavior: "wait" });
        await expectNeutral(page);
        expect(projections).toBe(1);
      });
    }
  });
}

for (const operator of [false, true]) {
  test(`Engine has one normal Refresh action (${operator ? "operator" : "reader"})`, async ({ page }) => {
    await seedSession(page); await knowledgeApi(page);
    await page.route("**/api/v1/auth/me", (route) => reply(route, { ...USER, is_operator: operator }));
    await page.goto("/app");
    await navigation(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
    await lab(page).getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Engine", exact: true }).click();
    await expect(lab(page).getByRole("button", { name: "Refresh Lab data" })).toHaveCount(1);
    await expect(lab(page).getByRole("button", { name: "Refresh engine status" })).toHaveCount(0);
    await expect(lab(page).getByRole("heading", { name: "Shared index", exact: true }).locator("..")).toContainText(operator ? "Operator access" : "Read-only");
  });
}

test("Engine retains contextual Retry when status fails", async ({ page }) => {
  await seedSession(page); await knowledgeApi(page);
  let failed = true;
  await page.route("**/api/v1/status", (route) => failed ? reply(route, { detail: "Status temporarily unavailable" }, 503)
    : reply(route, { engine: "hnsw", metric: "cosine", total_docs: 20 }));
  await page.goto("/app");
  await navigation(page).getByRole("button", { name: "Vector Lab", exact: true }).click();
  await lab(page).getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Engine", exact: true }).click();
  await expect(lab(page).getByText("Engine status is unavailable.")).toBeVisible();
  failed = false;
  await lab(page).getByRole("button", { name: "Retry", exact: true }).click();
  await expect(lab(page).getByText("Engine status is unavailable.")).toHaveCount(0);
  await expect(lab(page).getByRole("button", { name: "Refresh engine status" })).toHaveCount(0);
});
