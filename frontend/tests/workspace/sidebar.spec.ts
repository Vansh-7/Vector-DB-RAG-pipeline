import { test, expect, seedSession, TOKEN_KEY, reply } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  for (const width of [1440, 1280, 1024, 390]) {
    test(`${theme} sidebar geometry and account menu at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await appearance(page, theme);
      await seedSession(page); await knowledgeApi(page); await page.goto("/app");
      const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
      await expect(sidebar).toHaveCSS("width", width >= 768 ? "232px" : "56px");
      if (width >= 768) {
        const recent = sidebar.getByRole("button", { name: "How does retrieval work?", exact: true });
        await expect(recent).toHaveCSS("height", "32px");
        await expect(recent.locator("svg")).toHaveCount(0);
        await recent.click();
        await expect(recent).toHaveAttribute("aria-current", "page");
        await sidebar.getByRole("button", { name: "Collapse navigation" }).click();
      }
      await expect(sidebar).toHaveCSS("width", "56px");
      const controls = sidebar.locator(".sidebar-control:visible");
      const boxes = await controls.evaluateAll((items) => items.map((item) => {
        const { x, width, height } = item.getBoundingClientRect();
        return { center: x + width / 2, width, height };
      }));
      expect(boxes.length).toBe(width >= 768 ? 7 : 6);
      for (const box of boxes) {
        expect(box.width).toBe(width < 640 ? 44 : 36);
        expect(box.height).toBe(width < 640 ? 44 : 36);
        expect(box.center).toBe(boxes[0].center);
      }
      for (const view of ["Documents", "Search", "Vector Lab", "Chat"]) {
        await sidebar.getByRole("button", { name: view, exact: true }).click();
        await expect(sidebar).toHaveCSS("width", "56px");
      }
      const trigger = sidebar.getByRole("button", { name: "Account menu", exact: true });
      await trigger.click();
      const menu = page.getByRole("menu", { name: "Account", exact: true });
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(menu).toHaveCSS("width", "244px");
      await expect(menu).toHaveCSS("box-shadow", "none");
      await expect(menu).toHaveCSS("opacity", "1");
      await expect(menu.getByText("reader@example.com", { exact: true })).toBeVisible();
      const bounds = (await menu.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`sidebar-${theme}-${width}.png`) });
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      if (width >= 768) {
        await sidebar.getByRole("button", { name: "Expand navigation" }).click();
        await trigger.click();
        await expect(menu).toHaveCSS("opacity", "1");
        await page.screenshot({ path: testInfo.outputPath(`account-expanded-${theme}-${width}.png`) });
      }
    });
  }

  test(`${theme} account keyboard navigation, appearance and logout retain the session boundary`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page);
    const { calls } = await knowledgeApi(page); await page.goto("/app");
    const trigger = page.getByRole("button", { name: "Account menu", exact: true });
    await trigger.focus(); await page.keyboard.press("ArrowUp");
    await expect(page.getByRole("menuitem", { name: "Log out", exact: true })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(page.getByRole("menuitem", { name: /Appearance/ })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Log out", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menu", { name: "Appearance", exact: true })).toBeVisible();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitemradio", { name: "Dark", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("menuitem", { name: /Appearance/ })).toBeFocused();
    await page.keyboard.press("Enter");
    const next = theme === "light" ? "Dark" : "Light";
    const option = page.getByRole("menuitemradio", { name: next, exact: true });
    await option.focus();
    await expect(option).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Space");
    await expect(trigger).toBeFocused();
    await expect(page.locator("html")).toHaveAttribute("data-theme", next.toLowerCase());
    expect(await page.evaluate(() => localStorage.getItem("neuebit-theme"))).toBe(next.toLowerCase());
    await trigger.click(); await page.keyboard.press("Tab");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await trigger.click();
    await page.getByRole("heading", { name: "Ask your knowledge", exact: true }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).fill("Private draft");
    await trigger.click(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
    await page.getByRole("dialog", { name: "Log out of Neuebit?", exact: true }).getByRole("button", { name: "Log out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    expect(calls.filter((call) => call.path.startsWith("/auth")).map((call) => call.path)).toEqual(["/auth/me"]);
  });
}

test("text-only recent chats still truncate, rename and delete through the existing API", async ({ page }) => {
  await seedSession(page); await knowledgeApi(page);
  const title = "A deliberately long conversation title that needs truncation in the sidebar";
  let current = title;
  let deleted = false;
  const writes: unknown[] = [];
  await page.route("**/api/v1/conversations", (route) => reply(route, deleted ? [] : [{ id: 7, title: current, created_at: "2026-10-01", updated_at: "2026-10-01" }]));
  await page.route("**/api/v1/conversations/7", (route) => {
    const request = route.request();
    writes.push({ method: request.method(), body: request.postData(), authorization: request.headers()["authorization"] });
    if (request.method() === "DELETE") { deleted = true; return reply(route, { status: "deleted" }); }
    current = request.postDataJSON().title;
    return reply(route, { id: 7, title: current, created_at: "2026-10-01", updated_at: "2026-10-01" });
  });
  await page.goto("/app");
  const row = page.getByRole("button", { name: title, exact: true });
  await expect(row).toBeVisible(); await expect(row.locator("svg")).toHaveCount(0);
  expect(await row.locator("span").evaluate((item) => item.scrollWidth > item.clientWidth)).toBe(true);
  const options = page.getByRole("button", { name: `Options for ${title}`, exact: true });
  await options.focus(); await expect(options).toHaveCSS("opacity", "1"); await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Rename", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByLabel("Conversation name").fill("Retrieval notes");
  await page.getByRole("button", { name: "Save name", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retrieval notes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Options for Retrieval notes", exact: true }).click();
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await page.getByRole("dialog", { name: "Delete chat?" }).getByRole("button", { name: "Delete chat", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retrieval notes", exact: true })).toHaveCount(0);
  expect(writes).toEqual([
    { method: "PATCH", body: JSON.stringify({ title: "Retrieval notes" }), authorization: "Bearer entry-test-token" },
    { method: "DELETE", body: null, authorization: "Bearer entry-test-token" },
  ]);
});
