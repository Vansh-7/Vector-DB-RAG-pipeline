import { test, expect, seedSession, SESSION_TOKEN, reply, deferred } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1280, 1024, 390]) {
    test(`${theme} workspace panes and Lab at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await appearance(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await seedSession(page);
      await knowledgeApi(page);
      await page.route("**/api/v1/benchmark*", (route) => reply(route, { algorithms: [], timestamp: "2026-10-05T10:00:00Z" }));
      await page.goto("/app");
      const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
      if (width < 768) {
        // Recent history is intentionally hidden by the existing compact navigation.
        await page.setViewportSize({ width: 1024, height: 900 });
      }
      await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await page.setViewportSize({ width, height: 900 });
      const trigger = page.getByRole("button", { name: "2 sources" });
      await trigger.click();
      const pane = page.getByRole(width >= 1280 ? "complementary" : "dialog", { name: "Answer sources" });
      await expect(pane).toBeVisible();
      await expect(pane.getByRole("heading", { name: "Answer sources", exact: true })).toHaveCSS("color", theme === "light" ? "rgb(39, 38, 33)" : "rgb(242, 242, 242)");
      await expect(pane).toHaveCSS("box-shadow", "none");
      const paneBox = (await pane.boundingBox())!;
      if (width >= 1280) {
        await expect(pane).not.toHaveAttribute("aria-modal");
        const composer = (await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).boundingBox())!;
        expect(composer.x + composer.width).toBeLessThanOrEqual(paneBox.x);
        expect(paneBox.width).toBe(380);
        expect(paneBox.x - 232).toBeGreaterThanOrEqual(640);
        await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).focus();
        await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(pane).toBeVisible();
      } else {
        await expect(pane).toHaveAttribute("aria-modal", "true");
        const close = pane.getByRole("button", { name: "Close answer sources" });
        await close.focus(); await page.keyboard.press("Shift+Tab");
        await expect(pane.getByRole("button", { name: "View in Vector Lab" })).toBeFocused();
        if (width === 390) expect(paneBox.width).toBe(390);
      }
      const passage = pane.getByRole("region", { name: "Retrieved passage" });
      const firstPassage = await passage.innerText();
      await pane.getByRole("navigation", { name: "Retrieved sources" }).getByRole("button").nth(1).click();
      expect(await passage.innerText()).not.toBe(firstPassage);
      expect(await passage.locator("p").count()).toBe(1);
      await page.screenshot({ path: testInfo.outputPath(`sources-${theme}-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(pane).toBeHidden();
      await expect(trigger).toBeFocused();
      await page.getByRole("button", { name: "Add document to knowledge" }).click();
      const add = page.getByRole(width >= 1280 ? "complementary" : "dialog", { name: "Add document", exact: true });
      await expect(add).toBeVisible();
      await expect(page.getByRole("complementary", { name: "Answer sources" })).toHaveCount(0);
      await expect(add.getByRole("button", { name: "Index document" })).toBeDisabled();
      await expect(add.getByRole("button", { name: "Choose a document file" })).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`add-${theme}-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Add document to knowledge" })).toBeFocused();
      await sidebar.getByRole("button", { name: "Documents", exact: true }).click();
      await page.getByRole("button", { name: "Add document", exact: true }).click();
      await expect(add).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Add document", exact: true })).toBeFocused();
      await sidebar.getByRole("button", { name: "Vector Lab", exact: true }).click();
      const sections = page.getByRole("navigation", { name: "Vector Lab sections" });
      const boxes = await sections.getByRole("button").all();
      const widths = await Promise.all(boxes.map(async (button) => (await button.boundingBox())!.width));
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1);
      for (const area of ["Vector Space", "Engine", "Benchmarks", "Maintenance"]) {
        await sections.getByRole("button", { name: area, exact: true }).click();
        await expect(page.locator(`[aria-label="${area} context"]`)).toBeVisible();
        await expect(page.getByText("LLM · Not checked")).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (area === "Engine") await expect(page.locator('[aria-label="Engine context"]')).toContainText("Read-only");
        if (area === "Maintenance") await expect(page.getByRole("button", { name: "Save to Disk", exact: true })).toHaveCount(0);
      }
      await page.getByRole("button", { name: "Open terminal", exact: true }).click();
      await expect(page.locator("#terminal-output")).toBeVisible();
      await page.getByRole("button", { name: "Close terminal", exact: true }).click();
      await expect(page.getByRole("region", { name: "Terminal" })).toHaveCSS("height", "32px");
      if (width >= 768) {
        await expect(sidebar.getByRole("heading", { name: "Recent chats" })).toBeVisible();
        await sidebar.getByRole("button", { name: "Collapse navigation" }).click();
        await expect(sidebar).toHaveCSS("width", "56px");
        await sidebar.getByRole("button", { name: "Expand navigation" }).click();
      }
    });
  }
}

test("one ingestion owner preserves a selected file across pane modes and uses authenticated FormData", async ({ page }) => {
  await appearance(page, "dark"); await seedSession(page);
  const api = await knowledgeApi(page);
  let received: { authorization?: string; type?: string; body: string } | undefined;
  await page.route("**/api/v1/ingest/file", async (route) => {
    const request = route.request();
    received = { authorization: request.headers()["authorization"], type: request.headers()["content-type"], body: request.postDataBuffer()!.toString() };
    await reply(route, { document_id: 4, status: "ready", chunk_count: 2, message: "Indexed" });
  });
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/app");
  const plus = page.getByRole("button", { name: "Add document to knowledge" }); await plus.click();
  await page.getByLabel("Upload document file").setInputFiles({ name: "knowledge.md", mimeType: "text/markdown", buffer: Buffer.from("A sample knowledge passage.") });
  await expect(page.getByText("knowledge.md", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole("dialog", { name: "Add document" })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("complementary", { name: "Add document" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "Documents", exact: true }).click();
  await page.getByRole("button", { name: "Add document", exact: true }).click();
  await expect(page.getByText("knowledge.md", { exact: true })).toBeVisible();
  const docReads = api.calls.filter((call) => call.path === "/documents").length;
  await page.getByRole("button", { name: "Index document" }).click();
  await expect(page.getByRole("complementary", { name: "Add document" })).toBeHidden();
  await expect(page.getByText("Document ready · 2 chunks indexed.")).toBeVisible();
  expect(received?.authorization).toBe(`Bearer ${SESSION_TOKEN}`);
  expect(received?.type).toContain("multipart/form-data; boundary=");
  expect(received?.body).toContain('name="file"; filename="knowledge.md"');
  await expect.poll(() => api.calls.filter((call) => call.path === "/documents").length).toBeGreaterThan(docReads);
});

test("paste busy/error recovery and auth expiry clear the pane with the existing session", async ({ page }) => {
  await appearance(page, "light"); await seedSession(page); await knowledgeApi(page);
  const release = deferred();
  let authExpired = false;
  let body: unknown;
  await page.route("**/api/v1/ingest", async (route) => {
    body = route.request().postDataJSON();
    await release.promise;
    await reply(route, { detail: authExpired ? "Session expired" : "Indexing unavailable. Try again." }, authExpired ? 401 : 503);
  });
  await page.setViewportSize({ width: 1024, height: 900 }); await page.goto("/app");
  await page.getByRole("button", { name: "Add document to knowledge" }).click();
  const add = page.getByRole("dialog", { name: "Add document" });
  await add.getByRole("button", { name: "Paste text", exact: true }).click();
  await add.getByLabel("Title (optional)").fill("Team notes");
  await add.getByLabel("Document content").fill("The team owns its knowledge.");
  await add.getByRole("button", { name: "Index document" }).click();
  await expect(add.getByRole("button", { name: "Processing document…" })).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(add).toBeVisible();
  await expect(add.getByRole("button", { name: "Close add document" })).toBeDisabled();
  release.resolve();
  await expect(add.getByRole("alert")).toContainText("Indexing unavailable");
  expect(body).toEqual({ text: "Team notes\n\nThe team owns its knowledge.", category: "DOCUMENTS", title: "Team notes" });
  await expect(add.getByLabel("Document content")).toHaveValue("The team owns its knowledge.");
  authExpired = true;
  await add.getByRole("button", { name: "Index document" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("kernspace-access-token"))).toBeNull();
  await expect(page.locator(".context-pane")).toHaveCount(0);
});
