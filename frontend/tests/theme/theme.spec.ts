import { test, expect, deferred, seedSession, stubApi, fillCredentials, expectWorkspace, expectNoProductCode, SESSION_TOKEN, chooseAppTheme, signOutFromApp } from "../entry/fixtures";
import { appearance, knowledgeApi } from "./fixtures";

for (const [os, stored, expected] of [
  ["light", undefined, "light"], ["dark", undefined, "dark"],
  ["dark", "light", "light"], ["light", "dark", "dark"],
] as const) {
  test(`before React: ${os} OS with ${stored ?? "no"} preference paints ${expected}`, async ({ page }) => {
    await appearance(page, os, stored);
    const release = deferred();
    await page.route("**/assets/index-*.js", async (route) => { await release.promise; await route.continue(); });
    await page.goto("/", { waitUntil: "commit" });
    try {
      await expect(page.locator("html")).toHaveAttribute("data-theme", expected);
      await expect(page.locator("#root")).toBeEmpty();
      await expect(page.locator("body")).toHaveCSS("background-color", expected === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)");
    } finally { release.resolve(); }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", expected === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)");
    expect(await page.evaluate(() => localStorage.getItem("neuebit-theme"))).toBe(stored ?? null);
  });
}

test("landing toggle is keyboard accessible, persists on refresh, and preserves routing and logout", async ({ page }) => {
  await appearance(page, "light");
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Switch to dark theme" });
  await toggle.focus();
  await expect(toggle).toHaveCSS("outline-style", "solid");
  await expect(page.getByRole("tooltip", { name: "Switch to dark theme" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("neuebit-theme"))).toBe("dark");
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
  await page.reload();
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-page-surface", "product");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(8, 9, 10)");
  await fillCredentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectWorkspace(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await chooseAppTheme(page, "light");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await signOutFromApp(page);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => localStorage.getItem("neuebit-theme"))).toBe("light");
  await page.getByRole("link", { name: "Back to Neuebit" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-page-surface", "marketing");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  expect(calls.filter((call) => call.path.startsWith("/auth")).map((call) => call.path)).toEqual(["/auth/login", "/auth/me"]);
});

test("system preference follows OS changes until the visitor explicitly chooses a theme", async ({ page }) => {
  await appearance(page, "light");
  await stubApi(page);
  await page.goto("/");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => localStorage.getItem("neuebit-theme"))).toBeNull();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("blocked appearance storage does not break prepaint or the theme control", async ({ page }) => {
  await appearance(page, "dark");
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    const set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === "neuebit-theme") throw new DOMException("Unavailable", "SecurityError");
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === "neuebit-theme") throw new DOMException("Unavailable", "SecurityError");
      return set.call(this, key, value);
    };
  });
  await stubApi(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 390, 1440]) {
    test(`${theme} landing at ${width}px preserves appearance across tour, mobile navigation and 200% text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await appearance(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const { calls, scripts } = await stubApi(page);
      await page.goto("/");
      await expect(page.locator(".tour-layout")).toHaveAttribute("data-tour-layout", width === 1440 ? "stage" : "chapters");
      if (width === 1440) await page.getByRole("tab", { name: /Ask \+ verify/ }).click();
      await expect(page.locator(".demo-chat")).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(17, 18, 20)");
      await page.getByRole("button", { name: "2 sources" }).click();
      await expect(page.getByRole("complementary", { name: "Preview answer sources" })).toBeVisible();
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      await expect(page.locator(".tour-layout")).toHaveAttribute("data-tour-layout", "chapters");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width < 768) {
        await page.getByRole("button", { name: "Open navigation" }).click();
        await expect(page.locator("#public-mobile-links").getByRole("link")).toHaveText(["Product", "How it works", "Vector Lab", "GitHub", "Sign in", "Get started"]);
      }
      const toggle = page.getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` });
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await toggle.focus(); await page.keyboard.press("Enter");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
      await expect(page.locator(".demo-chat")).toHaveCSS("background-color", theme === "light" ? "rgb(17, 18, 20)" : "rgb(255, 255, 255)");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(calls).toEqual([]); expectNoProductCode(scripts);
    });
  }

  test(`${theme} product themes Chat, sources, Documents, drawers, Search, and Vector Lab without changing requests`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await appearance(page, theme);
    await seedSession(page);
    const { calls, writes } = await knowledgeApi(page);
    await page.goto("/app");
    await expectWorkspace(page);
    const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
    await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
    const chat = page.getByRole("region", { name: "Chat workspace" });
    await chat.getByRole("button", { name: "2 sources" }).click();
    await expect(page.getByRole("complementary", { name: "Answer sources" })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)");
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole("button", { name: "Close answer sources" }).evaluate((button) => (button as HTMLElement).blur());
    await page.screenshot({ path: testInfo.outputPath(`chat-1440-${theme}.png`) });
    await page.getByRole("button", { name: "Close answer sources" }).click();
    await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).fill("How is tenant isolation enforced?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(chat.getByText(/The vector index is shared, but/)).toBeVisible();
    expect(writes[0]).toEqual({ path: "/ask", body: { question: "How is tenant isolation enforced?", k: 5, conversation_id: 7 }, authorization: `Bearer ${SESSION_TOKEN}` });
    await sidebar.getByRole("button", { name: "Documents", exact: true }).click();
    await page.getByRole("button", { name: "Add document", exact: true }).click();
    const drawer = page.getByRole("complementary", { name: "Add document", exact: true });
    await expect(drawer).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(27, 28, 32)");
    await page.getByRole("button", { name: "Close add document" }).click();
    await page.getByRole("button", { name: "Delete Product architecture.md", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "Delete document?" });
    await expect(deletion).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(17, 18, 20)");
    await expect(deletion.getByRole("button", { name: "Delete document", exact: true })).toHaveCSS("background-color", theme === "light" ? "rgba(198, 44, 44, 0.05)" : "rgba(239, 68, 68, 0.05)");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await sidebar.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("searchbox", { name: "Search your knowledge" }).fill("retrieval");
    await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("region", { name: "Search workspace" }).getByText("2 matches", { exact: true })).toBeVisible();
    expect(writes[1]).toEqual({ path: "/search/text", body: { text: "retrieval", k: 5 }, authorization: `Bearer ${SESSION_TOKEN}` });
    await sidebar.getByRole("button", { name: "Vector Lab", exact: true }).click();
    await expect(page.locator(".data-point")).toHaveCount(20);
    await expect(page.locator(".vector-canvas-grid")).toBeVisible();
    await page.locator(".data-point").first().click();
    await expect(page.getByRole("complementary", { name: "Vector inspector" }).getByText("sample-1", { exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`vector-lab-1440-${theme}.png`) });
    const requestsBeforeToggle = calls.length;
    await chooseAppTheme(page, theme === "light" ? "dark" : "light");
    await expect(page.getByRole("complementary", { name: "Vector inspector" }).getByText("sample-1", { exact: true })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "light" ? "rgb(8, 9, 10)" : "rgb(255, 255, 255)");
    expect(calls.length).toBe(requestsBeforeToggle);
    await expect(page.getByRole("region", { name: "Terminal" })).toHaveCSS("background-color", "rgb(12, 13, 14)");
    const terminalFocusColor = await page.getByRole("region", { name: "Terminal" }).evaluate((element) => getComputedStyle(element).getPropertyValue("--color-info").trim());
    expect(terminalFocusColor).toBe("rgb(139 181 248)");
    expect(calls.filter((call) => call.path !== "/auth/me").every((call) => call.authorization === `Bearer ${SESSION_TOKEN}`)).toBe(true);
  });

  for (const width of [320, 390]) {
    test(`${theme} auth and product at ${width}px keep theme controls and workspaces usable with enlarged text`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await appearance(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await knowledgeApi(page);
      await page.goto("/auth");
      await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
      const toggle = page.getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` });
      await toggle.focus();
      await expect(toggle).toHaveCSS("outline-style", "solid");
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await fillCredentials(page);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
      await expectWorkspace(page);
      const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
      for (const view of ["Chat", "Documents", "Search", "Vector Lab"]) {
        await sidebar.getByRole("button", { name: view, exact: true }).click();
        await expect(page.getByRole("region", { name: `${view} workspace` })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      await chooseAppTheme(page, theme === "light" ? "dark" : "light");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
      await signOutFromApp(page);
      await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
