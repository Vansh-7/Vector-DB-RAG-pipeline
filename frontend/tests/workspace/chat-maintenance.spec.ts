import { test, expect, seedSession, TOKEN_KEY, SESSION_TOKEN, reply, deferred } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

const document = (id: number, name: string, status = "ready", chunk_count = 3) => ({
  id, name, status, chunk_count, category: "TECH", source_type: "file", created_at: "2026-10-05T10:00:00Z",
});
const title = "How document retrieval and tenant isolation work across a deliberately long shared vector engine conversation";
const conversation = (name = title) => ({ id: 7, title: name, created_at: "2026-10-05", updated_at: "2026-10-05" });
const docs = [document(9, "Still processing.pdf", "processing"), document(8, "Product architecture.md"),
  document(7, "Retrieval design and account isolation — implementation notes.pdf"), document(6, "Older notes.md")];

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1280, 1024, 390]) {
    test(`${theme} Chat hierarchy and Maintenance separators at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 }); await appearance(page, theme);
      await seedSession(page); await knowledgeApi(page);
      await page.route("**/api/v1/documents", (route) => reply(route, docs));
      await page.route("**/api/v1/conversations", (route) => reply(route, [conversation()]));
      await page.goto("/app");
      const chat = page.getByRole("region", { name: "Chat workspace", exact: true });
      const header = chat.locator("header");
      await expect(header).toHaveCSS("height", "56px");
      await expect(header.getByRole("heading", { name: "New chat", exact: true })).toHaveCSS("font-size", "17px");
      const suggestions = chat.locator('[aria-label="Example questions"]');
      await expect(suggestions.getByRole("button")).toHaveText([
        "Summarize Product architecture.md",
        "What are the key ideas in Retrieval design and account isolation — implementation notes.pdf?",
        "Compare Product architecture.md and Retrieval design and account isolation — implementation notes.pdf",
      ]);
      const first = suggestions.getByRole("button").first();
      await first.focus(); await page.keyboard.press("Space");
      await expect(chat.getByRole("textbox", { name: "Ask a question about your knowledge" })).toHaveValue("Summarize Product architecture.md");
      await page.screenshot({ path: testInfo.outputPath(`chat-starters-${theme}-${width}.png`) });
      if (width >= 768) await page.getByRole("button", { name: title, exact: true }).click();
      else {
        // Recent rows are hidden by the existing mobile rail; select via the existing desktop UI first.
        await page.setViewportSize({ width: 1024, height: 900 });
        await page.getByRole("button", { name: title, exact: true }).click();
        await page.setViewportSize({ width, height: 900 });
      }
      const heading = header.getByRole("heading", { name: title, exact: true });
      await expect(heading).toHaveAttribute("title", title);
      await expect(heading).toHaveCSS("font-size", "17px");
      expect(await heading.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await chat.getByRole("button", { name: "Conversation actions", exact: true }).focus();
      await expect(chat.getByRole("button", { name: "Conversation actions", exact: true })).toHaveCSS("opacity", "1");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`chat-header-${theme}-${width}.png`) });

      await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "Vector Lab", exact: true }).click();
      await page.getByRole("navigation", { name: "Vector Lab sections" }).getByRole("button", { name: "Maintenance", exact: true }).click();
      const deletion = page.getByRole("heading", { name: "Delete a vector", exact: true }).locator("..").locator("..");
      const clear = page.getByRole("heading", { name: "Clear vector data", exact: true }).locator("..").locator("..");
      const borders = await page.evaluate(() => {
        const sections = [...document.querySelectorAll("section")].filter((element) => element.querySelector("h3")?.textContent === "Delete a vector" || element.querySelector("h3")?.textContent === "Clear vector data");
        return sections.map((element) => ({ top: getComputedStyle(element).borderTopWidth, bottom: getComputedStyle(element).borderBottomWidth }));
      });
      expect(borders).toEqual([{ top: "0px", bottom: "0px" }, { top: "1px", bottom: "0px" }]);
      await expect(deletion.getByRole("button", { name: "Delete vector", exact: true })).toBeDisabled();
      await expect(clear.getByRole("button", { name: "Clear data", exact: true })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Save to Disk", exact: true })).toHaveCount(0);
      await clear.getByRole("button", { name: "Clear data", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Clear your vector data?", exact: true });
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`maintenance-${theme}-${width}.png`) });
    });
  }

  test(`${theme} ready-document starters handle zero, one and several documents through the existing Chat flow`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); const { writes } = await knowledgeApi(page);
    let data = [document(1, "Failed.pdf", "failed"), document(2, "Pending.md", "processing"), document(3, "Empty.md", "ready", 0)];
    await page.route("**/api/v1/documents", (route) => reply(route, data));
    await page.goto("/app");
    await expect(page.getByText("Add a document to start asking questions.", { exact: true })).toBeVisible();
    await expect(page.locator('[aria-label="Example questions"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Add document", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Add document", exact: true }).getByRole("button", { name: "Upload file", exact: true })).toBeVisible();
    expect(writes).toHaveLength(0);
    data = [document(1, "Pending.md", "processing"), document(2, "Product architecture.md")];
    await page.reload();
    const suggestions = page.locator('[aria-label="Example questions"]');
    await expect(suggestions.getByRole("button")).toHaveText(["Summarize Product architecture.md", "What are the main ideas in Product architecture.md?", "What should I know from Product architecture.md?"]);
    data = docs; await page.reload();
    const selected = "Compare Product architecture.md and Retrieval design and account isolation — implementation notes.pdf";
    await suggestions.getByRole("button", { name: selected, exact: true }).focus(); await page.keyboard.press("Enter");
    const input = page.getByRole("textbox", { name: "Ask a question about your knowledge" });
    await expect(input).toHaveValue(selected); expect(writes).toHaveLength(0);
    await input.press("Enter");
    await expect.poll(() => writes.length).toBe(1);
    expect(writes[0].authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    expect(writes[0].body).toMatchObject({ question: selected });
    await expect(page.getByRole("button", { name: "2 sources", exact: true }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Conversation actions", exact: true })).toBeEnabled();
  });

  test(`${theme} document loading and errors never produce invented starter prompts`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    const hold = deferred(); let failed = true;
    await page.route("**/api/v1/documents", async (route) => { await hold.promise; await reply(route, failed ? { detail: "Documents unavailable" } : [document(1, "Recovered.md")], failed ? 503 : 200); });
    await page.goto("/app");
    await expect(page.getByRole("status").filter({ hasText: "Loading your documents…" })).toBeVisible();
    await expect(page.locator('[aria-label="Example questions"]')).toHaveCount(0); hold.resolve();
    await expect(page.getByRole("alert").filter({ hasText: "Could not load documents." })).toBeVisible();
    failed = false; await page.getByRole("alert").filter({ hasText: "Could not load documents." }).getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("button", { name: "Summarize Recovered.md", exact: true })).toBeVisible();
  });

  test(`${theme} Log out confirmation protects the session, traps focus and uses existing cleanup`, async ({ page }, testInfo) => {
    await appearance(page, theme); await seedSession(page); const { calls } = await knowledgeApi(page); await page.goto("/app");
    const input = page.getByRole("textbox", { name: "Ask a question about your knowledge" });
    await input.fill("Private unsent draft");
    const account = page.getByRole("button", { name: "Account menu", exact: true });
    const open = async () => { await account.click(); await page.getByRole("menuitem", { name: "Log out", exact: true }).click(); };
    const dialog = page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true });
    await open(); await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await expect(dialog).toHaveCSS("box-shadow", "none");
    await expect(dialog).toContainText("You’ll need to sign in again to access your workspace.");
    await page.screenshot({ path: testInfo.outputPath(`logout-${theme}.png`) });
    await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Shift+Tab");
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(account).toBeFocused();
    await expect(input).toHaveValue("Private unsent draft");
    await open(); await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0); await expect(account).toBeFocused();
    await open(); await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(account).toBeFocused(); await expect(input).toHaveValue("Private unsent draft");
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(SESSION_TOKEN);
    await open(); await page.mouse.click(2, 2); await expect(dialog).toHaveCount(0); await expect(account).toBeFocused();
    await open(); await dialog.getByRole("button", { name: "Log out", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    expect(calls.filter((call) => call.path.startsWith("/auth")).map((call) => call.path)).toEqual(["/auth/me"]);
    await page.reload(); await expect(page.getByRole("heading", { name: "Welcome back", exact: true })).toBeVisible();
  });

  test(`${theme} header conversation actions work with the sidebar collapsed and preserve authenticated mutations`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    let current = title; let deleted = false; let failRename = true;
    const writes: { method: string; body: unknown; authorization?: string }[] = [];
    await page.route("**/api/v1/conversations", (route) => reply(route, deleted ? [] : [conversation(current)]));
    await page.route("**/api/v1/conversations/7", (route) => {
      const request = route.request(); writes.push({ method: request.method(), body: request.postDataJSON(), authorization: request.headers()["authorization"] });
      if (request.method() === "DELETE") { deleted = true; return reply(route, { status: "deleted" }); }
      if (failRename) return reply(route, { detail: "Rename failed" }, 503);
      current = request.postDataJSON().title; return reply(route, conversation(current));
    });
    await page.goto("/app"); await page.getByRole("button", { name: title, exact: true }).click();
    await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
    const actions = page.getByRole("button", { name: "Conversation actions", exact: true });
    await actions.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Rename", exact: true })).toBeFocused();
    await page.keyboard.press("Escape"); await expect(actions).toBeFocused();
    await actions.click(); await page.getByRole("menuitem", { name: "Rename", exact: true }).click();
    await page.getByLabel("Conversation name").fill("Retrieval notes"); await page.getByRole("button", { name: "Save name", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Rename chat", exact: true }).getByRole("alert")).toContainText("Rename failed");
    failRename = false; await page.getByRole("button", { name: "Save name", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Retrieval notes", exact: true })).toBeVisible(); await expect(actions).toBeFocused();
    await actions.click(); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
    const confirmation = page.getByRole("dialog", { name: "Delete chat?", exact: true });
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click(); await expect(actions).toBeFocused();
    await actions.click(); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await confirmation.getByRole("button", { name: "Delete chat", exact: true }).click();
    await expect(page.getByRole("heading", { name: "New chat", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ask your knowledge", exact: true })).toBeVisible();
    await expect(actions).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toBeFocused();
    expect(writes.map((write) => write.method)).toEqual(["PATCH", "PATCH", "DELETE"]);
    expect(writes.every((write) => write.authorization === `Bearer ${SESSION_TOKEN}`)).toBe(true);
    expect(writes[1].body).toEqual({ title: "Retrieval notes" });
  });
}
