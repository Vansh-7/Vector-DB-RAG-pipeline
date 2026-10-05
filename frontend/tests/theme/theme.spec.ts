import { writeFile } from "node:fs/promises";
import { test, expect, deferred, seedSession, stubApi, fillCredentials, expectWorkspace, expectNoProductCode, SESSION_TOKEN, chooseAppTheme, signOutFromApp, reply } from "../entry/fixtures";
import { appearance, knowledgeApi } from "./fixtures";

// Capture the same product states in both themes so palette changes can be
// reviewed without conflating color with geometry or navigation changes.
for (const theme of ["light", "dark"] as const) {
  for (const width of theme === "light" ? [390, 1024, 1280, 1440] : [1280, 1440]) {
    test(`${theme} authenticated surface hierarchy at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await appearance(page, theme);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await seedSession(page);
      await knowledgeApi(page);
      // Contract-shaped comparison fixtures verify surfaces, not performance.
      await page.route("**/api/v1/benchmark*", (route) => reply(route, {
        algorithms: [
          { name: "hnsw", displayName: "HNSW Graph", latencyMs: .41, throughputQps: 2453, isActive: true },
          { name: "kdtree", displayName: "KD-Tree", latencyMs: 1.25, throughputQps: 800, isActive: false },
          { name: "exact", displayName: "Brute Force (Exact Match)", latencyMs: 2.5, throughputQps: 400, isActive: false },
        ], timestamp: "2026-10-05T10:00:00Z",
        topology: [{ level: 0, nodes: 34, edges: 1088 }, { level: 1, nodes: 4, edges: 12 }, { level: 2, nodes: 1, edges: 0 }],
      }));
      await page.goto("/app");
      await expectWorkspace(page);
      await page.evaluate(() => document.fonts.ready);
      const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
      if (theme === "light") {
        await expect(page.locator(".authenticated-app")).toHaveCSS("background-color", "rgb(253, 253, 252)");
        await expect(sidebar).toHaveCSS("background-color", "rgb(243, 242, 239)");
        await expect(page.locator(".chat-composer")).toHaveCSS("background-color", "rgb(255, 255, 255)");
        // Small metadata remains readable on chrome and filled controls.
        const contrast = await sidebar.evaluate((element) => {
          const style = getComputedStyle(element);
          const luminance = (rgb: number[]) => rgb.map((channel) => {
            const value = channel / 255;
            return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
          }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
          const text = style.getPropertyValue("--text-tertiary").trim().slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16));
          const background = style.backgroundColor.match(/[\d.]+/g)!.map(Number);
          return (luminance(background) + .05) / (luminance(text) + .05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
        const active = sidebar.getByRole("button", { name: "Chat", exact: true });
        const inactive = sidebar.getByRole("button", { name: "Documents", exact: true });
        const selected = await active.evaluate((element) => getComputedStyle(element).backgroundColor);
        await inactive.hover();
        const hover = await inactive.evaluate((element) => getComputedStyle(element).backgroundColor);
        expect(hover).not.toBe(selected);
        await active.hover();
        await expect(active).toHaveCSS("background-color", selected);
        await page.mouse.move(width - 1, 1);
      }
      const captures: Record<string, unknown> = {};
      const capture = async (state: string) => {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        captures[state] = await page.evaluate(() => {
          const tokens = ["--canvas", "--surface", "--surface-elevated", "--surface-hover", "--surface-active",
            "--text-primary", "--text-secondary", "--text-tertiary", "--text-placeholder", "--border-subtle",
            "--border-default", "--border-strong", "--primary-action", "--primary-action-hover", "--primary-action-active",
            "--color-tech", "--color-finance", "--color-food", "--color-sports", "--color-documents", "--color-mathematics",
            "--color-success", "--color-info", "--color-warning", "--color-error"];
          const app = getComputedStyle(document.querySelector(".authenticated-app")!);
          const selectors = [".authenticated-app", ".primary-sidebar", ".sidebar-control", ".recent-chat-row", ".user-avatar",
            ".account-menu", ".account-menu-row", ".chat-composer", ".context-pane", "[role=dialog]", ".field",
            ".bg-panel", ".bg-elevated", ".lab-tab", ".technical-terminal"];
          return { tokens: Object.fromEntries(tokens.map((token) => [token, app.getPropertyValue(token).trim()])),
            elements: Object.fromEntries(selectors.map((selector) => [selector,
              [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => element.getClientRects().length).map((element) => {
                const style = getComputedStyle(element); const box = element.getBoundingClientRect();
                return { color: style.color, background: style.backgroundColor, border: style.borderTopColor,
                  shadow: style.boxShadow, font: style.font, radius: style.borderRadius,
                  box: [box.x, box.y, box.width, box.height].map((value) => Math.round(value * 100) / 100) };
              })])) };
        });
        await page.screenshot({ path: testInfo.outputPath(`${state}.png`) });
      };
      await capture("chat-empty");
      if (width < 768) await page.setViewportSize({ width: 1024, height: 900 });
      await sidebar.getByRole("button", { name: "How does retrieval work?", exact: true }).click();
      await page.setViewportSize({ width, height: 900 });
      const chat = page.getByRole("region", { name: "Chat workspace" });
      await expect(chat.getByRole("button", { name: "2 sources" })).toBeVisible();
      await capture("chat-conversation");
      await chat.getByRole("button", { name: "2 sources" }).click();
      await expect(page.getByRole(width >= 1280 ? "complementary" : "dialog", { name: "Answer sources" })).toBeVisible();
      await capture("source-pane");
      await page.getByRole("button", { name: "Close answer sources" }).click();
      const account = page.getByRole("button", { name: "Account menu", exact: true });
      await account.click();
      const menu = page.getByRole("menu", { name: "Account", exact: true });
      await expect(menu).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(32, 32, 32)");
      await expect(menu).toHaveCSS("box-shadow", "none");
      await capture("account-menu");
      await menu.getByRole("menuitem", { name: "Log out", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true });
      await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
      await capture("confirmation");
      await page.keyboard.press("Escape");
      await expect(account).toBeFocused();
      if (width >= 768) {
        await sidebar.getByRole("button", { name: "Collapse navigation", exact: true }).click();
        await expect(sidebar).toHaveCSS("width", "56px");
        await capture("sidebar-collapsed");
        await sidebar.getByRole("button", { name: "Expand navigation", exact: true }).click();
      }
      await sidebar.getByRole("button", { name: "Documents", exact: true }).click();
      await expect(page.getByRole("button", { name: "Delete Product architecture.md", exact: true })).toBeVisible();
      await capture("documents");
      await page.getByRole("button", { name: "Add document", exact: true }).click();
      await expect(page.getByRole(width >= 1280 ? "complementary" : "dialog", { name: "Add document", exact: true })).toBeVisible();
      await capture("add-document");
      await page.getByRole("button", { name: "Close add document" }).click();
      await sidebar.getByRole("button", { name: "Search", exact: true }).click();
      await page.getByRole("searchbox", { name: "Search your knowledge" }).fill("retrieval");
      await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.getByRole("region", { name: "Search workspace" }).getByText("2 matches", { exact: true })).toBeVisible();
      await capture("search");
      await sidebar.getByRole("button", { name: "Vector Lab", exact: true }).click();
      await expect(page.locator(".data-point")).toHaveCount(20);
      await capture("vector-space");
      const sections = page.getByRole("navigation", { name: "Vector Lab sections" });
      for (const section of ["Engine", "Benchmarks", "Maintenance"]) {
        await sections.getByRole("button", { name: section, exact: true }).click();
        if (section === "Benchmarks") await expect(page.getByRole("article", { name: "HNSW", exact: true })).toBeVisible();
        await capture(section.toLowerCase());
      }
      const surfacesPath = testInfo.outputPath("surfaces.json");
      await writeFile(surfacesPath, JSON.stringify(captures, null, 2));
      await testInfo.attach("product-surfaces", { path: surfacesPath, contentType: "application/json" });
    });
  }
}

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
      await expect(page.locator("body")).toHaveCSS("background-color", expected === "light" ? "rgb(255, 255, 255)" : "rgb(20, 20, 20)");
    } finally { release.resolve(); }
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("body")).toHaveCSS("background-color", expected === "light" ? "rgb(255, 255, 255)" : "rgb(20, 20, 20)");
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
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(20, 20, 20)");
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
  await page.getByRole("link", { name: "Back to NeueBit" }).click();
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
      await expect(page.locator(".demo-chat")).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 24, 24)");
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
      await expect(page.locator(".demo-chat")).toHaveCSS("background-color", theme === "light" ? "rgb(24, 24, 24)" : "rgb(255, 255, 255)");
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
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(20, 20, 20)");
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
    await expect(drawer).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(28, 28, 28)");
    await page.getByRole("button", { name: "Close add document" }).click();
    await page.getByRole("button", { name: "Delete Product architecture.md", exact: true }).click();
    const deletion = page.getByRole("dialog", { name: "Delete document?" });
    await expect(deletion).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(24, 24, 24)");
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
    await expect(page.locator("body")).toHaveCSS("background-color", theme === "light" ? "rgb(20, 20, 20)" : "rgb(255, 255, 255)");
    expect(calls.length).toBe(requestsBeforeToggle);
    await expect(page.getByRole("region", { name: "Terminal" })).toHaveCSS("background-color", "rgb(12, 12, 12)");
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
