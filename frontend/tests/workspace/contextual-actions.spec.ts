import { test, expect, seedSession, SESSION_TOKEN, USER, reply, deferred } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1280, 1024, 390]) {
    test(`${theme} contextual actions and read-only Engine at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: Math.max(width, 1024), height: 900 });
      await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
      await page.goto("/app");
      const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
      for (const label of ["New chat", "Chat", "Documents", "Search", "Vector Lab"]) {
        await sidebar.getByRole("button", { name: label, exact: true }).hover();
        // Radix's configured hover delay is 200ms; verify after it could open.
        await page.waitForTimeout(250);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
        await sidebar.getByRole("button", { name: label, exact: true }).focus();
        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await sidebar.getByRole("button", { name: "Collapse navigation" }).click();
      for (const label of ["New chat", "Chat", "Documents", "Search", "Vector Lab"]) {
        await sidebar.getByRole("button", { name: label, exact: true }).hover();
        await expect(page.getByRole("tooltip", { name: label, exact: true })).toBeVisible();
        const tooltip = (await page.getByRole("tooltip", { name: label, exact: true }).boundingBox())!;
        expect(tooltip.x).toBeGreaterThanOrEqual(0);
        expect(tooltip.x + tooltip.width).toBeLessThanOrEqual(Math.max(width, 1024));
      }
      await sidebar.getByRole("button", { name: "Expand navigation" }).click();
      await page.setViewportSize({ width, height: 900 });
      if (width < 768) {
        // CSS makes this a rail even though the explicit collapsed state is false.
        await sidebar.getByRole("button", { name: "Documents", exact: true }).hover();
        await expect(page.getByRole("tooltip", { name: "Documents", exact: true })).toBeVisible();
      }
      const chat = page.getByRole("region", { name: "Chat workspace" });
      const generic = chat.getByRole("button", { name: "Open vector space in Vector Lab", exact: true });
      await expect(generic).toBeVisible();
      const sourcesTrigger = chat.getByRole("button", { name: "2 sources" });
      await sourcesTrigger.click();
      const pane = page.getByRole(width >= 1280 ? "complementary" : "dialog", { name: "Answer sources" });
      await expect(pane).toBeVisible(); await expect(generic).toHaveCount(0);
      await expect(pane.getByRole("button", { name: "View in Vector Lab", exact: true })).toBeVisible();
      await pane.getByRole("button", { name: "Close answer sources" }).click();
      await expect(generic).toBeVisible(); await expect(sourcesTrigger).toBeFocused();
      await sourcesTrigger.click();
      if (width >= 1280) {
        await chat.getByRole("button", { name: "Add document to knowledge" }).click();
        await expect(generic).toBeVisible();
        await page.getByRole("complementary", { name: "Add document", exact: true }).getByRole("button", { name: "Close add document" }).click();
        // The existing Add Document action closes source inspection until reopened.
        await expect(generic).toBeVisible();
        await sourcesTrigger.click();
        await expect(generic).toHaveCount(0);
      }
      await pane.getByRole("navigation", { name: "Retrieved sources" }).getByRole("button").nth(1).click();
      const vectorId = await pane.locator("dl div").filter({ has: page.getByText("Vector ID", { exact: true }) }).locator("dd").innerText();
      const contextual = pane.getByRole("button", { name: "View in Vector Lab", exact: true });
      await contextual.focus(); await page.keyboard.press("Enter");
      const lab = page.getByRole("region", { name: "Vector Lab workspace" });
      await expect(lab).toBeVisible();
      if (width < 1280) await lab.getByRole("button", { name: "Open vector inspector" }).click();
      const inspector = page.getByRole("complementary", { name: "Vector inspector" });
      await expect(inspector).toContainText(vectorId);
      await expect(inspector).toContainText("0.80000");
      await lab.getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Engine", exact: true }).click();
      await expect(lab.getByText("Shared engine configuration is managed by Neuebit operators.")).toBeVisible();
      await expect(lab.getByRole("combobox", { name: "Index algorithm" })).toHaveCount(0);
      await expect(lab.getByRole("combobox", { name: "Distance metric", exact: true })).toHaveCount(0);
      await expect(lab.getByRole("button", { name: "Apply configuration", exact: true })).toHaveCount(0);
      await expect(lab.getByRole("spinbutton", { name: "Top K retrieval" })).toBeEnabled();
      await expect(lab.getByRole("heading", { name: "Manual vector injection" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const numeric = (await lab.getByRole("spinbutton", { name: "Top K retrieval" }).boundingBox())!;
      expect(numeric.width).toBe(64); expect(numeric.x + numeric.width).toBeLessThanOrEqual(width);
      await page.screenshot({ path: testInfo.outputPath(`engine-${theme}-${width}.png`) });
    });
  }

  test(`${theme} precise Top-K retains one value in slider, Search and Chat`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page);
    const api = await knowledgeApi(page); await page.goto("/app");
    const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
    await sidebar.getByRole("button", { name: "Vector Lab", exact: true }).click();
    await page.getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Engine", exact: true }).click();
    const numeric = page.getByRole("spinbutton", { name: "Top K retrieval" });
    const slider = page.getByRole("slider", { name: "Top K retrieval" });
    await slider.focus(); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
    await expect(numeric).toHaveValue("8");
    await numeric.fill("12"); await expect(slider).toHaveAttribute("aria-valuenow", "12");
    await numeric.press("ArrowUp"); await expect(slider).toHaveAttribute("aria-valuenow", "13");
    await numeric.press("ArrowDown"); await expect(slider).toHaveAttribute("aria-valuenow", "12");
    for (const [entered, expected] of [["0", "1"], ["99", "20"], ["7.6", "8"], ["", "8"]]) {
      await numeric.fill(entered); await numeric.press("Enter");
      await expect(numeric).toHaveValue(expected); await expect(slider).toHaveAttribute("aria-valuenow", expected);
    }
    await numeric.fill(""); await slider.focus(); await expect(numeric).toHaveValue("8");
    await numeric.fill("12"); await numeric.press("Enter");
    await sidebar.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search your knowledge", exact: true }).fill("retrieval");
    await page.getByRole("button", { name: "Search", exact: true }).last().click();
    await expect.poll(() => api.writes.filter((write) => write.path === "/search/text").length).toBe(1);
    expect(api.writes.find((write) => write.path === "/search/text")?.body).toMatchObject({ k: 12 });
    await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
    await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).fill("Explain retrieval");
    await page.getByRole("button", { name: "Send message", exact: true }).click();
    await expect.poll(() => api.writes.filter((write) => write.path === "/ask").length).toBe(1);
    expect(api.writes.find((write) => write.path === "/ask")?.body).toMatchObject({ k: 12 });
    expect(api.calls.filter((call) => call.path === "/engine/configure")).toEqual([]);
  });

  test(`${theme} operator configuration preserves supported options, busy and 403 states`, async ({ page }, testInfo) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    await page.route("**/api/v1/auth/me", (route) => reply(route, { ...USER, is_operator: true }));
    let status = { engine: "hnsw", metric: "cosine", total_docs: 20 };
    await page.route("**/api/v1/status", (route) => reply(route, status));
    const release = deferred(); const writes: { algorithm: string | null; metric: string | null; authorization?: string }[] = [];
    let denied = false;
    await page.route("**/api/v1/engine/configure?*", async (route) => {
      const request = route.request(); const query = new URL(request.url()).searchParams;
      writes.push({ algorithm: query.get("algorithm"), metric: query.get("metric"), authorization: request.headers()["authorization"] });
      await release.promise;
      if (denied) return reply(route, { detail: "Operator access required for shared-index operations." }, 403);
      status = { engine: query.get("algorithm")!, metric: query.get("metric")!, total_docs: 20 };
      await reply(route, { algorithm: status.engine, metric: status.metric, total_docs: 20 });
    });
    await page.goto("/app");
    await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "Vector Lab", exact: true }).click();
    await page.getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Engine", exact: true }).click();
    const index = page.getByRole("combobox", { name: "Index algorithm" });
    const metric = page.getByRole("combobox", { name: "Distance metric", exact: true });
    await index.click();
    await expect(page.getByRole("option")).toHaveText(["HNSW Graph", "KD-tree", "Brute Force (Exact Match)"]);
    await page.getByRole("option", { name: "KD-tree", exact: true }).click();
    await metric.click(); await expect(page.getByRole("option")).toHaveText(["Cosine Similarity", "Euclidean", "Manhattan Distance"]);
    await page.getByRole("option", { name: "Manhattan Distance", exact: true }).click();
    const numeric = page.getByRole("spinbutton", { name: "Top K retrieval" });
    await numeric.fill("12"); await numeric.press("Enter"); expect(writes).toEqual([]);
    await expect(page.getByText("Applying an algorithm or metric rebuilds the shared index for all users.")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`operator-engine-${theme}.png`) });
    await page.getByRole("button", { name: "Apply configuration", exact: true }).click();
    await expect(page.getByRole("button", { name: "Applying…", exact: true })).toBeDisabled();
    await expect(index).toBeDisabled(); await expect(metric).toBeDisabled(); await expect(numeric).toBeEnabled();
    release.resolve(); await expect(page.getByText("Engine configuration applied.")).toBeVisible();
    expect(writes).toEqual([{ algorithm: "kdtree", metric: "manhattan", authorization: `Bearer ${SESSION_TOKEN}` }]);
    await expect(page.locator('[aria-label="Engine context"]')).toContainText("KD-tree");
    denied = true; await index.click(); await page.getByRole("option", { name: "Brute Force (Exact Match)", exact: true }).click();
    await page.getByRole("button", { name: "Apply configuration", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Operator access required for shared-index operations.");
    await expect(page.getByRole("region", { name: "Vector Lab workspace" })).toBeVisible();
    await expect(index).toBeEnabled();
  });
}
