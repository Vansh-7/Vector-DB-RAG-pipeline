import { test, expect, stubApi, seedSession, deferred, reply, USER } from "../entry/fixtures";

async function geometry(page: import("@playwright/test").Page) {
  return page.locator(".marketing-nav").evaluate(nav => {
    const box = (selector: string) => nav.querySelector(selector)!.getBoundingClientRect().toJSON();
    return { width: innerWidth, nav: nav.getBoundingClientRect().toJSON(), brand: box(".marketing-brand"),
      links: box(".marketing-nav-desktop"), actions: box(".marketing-nav-access"),
      mark: box(".marketing-brand img"), primary: box(".marketing-nav-access .marketing-button") };
  });
}

for (const width of [1440, 1920]) for (const theme of ["light", "dark"] as const) {
  test(`viewport-centered navbar stays fixed through logout at ${width}px ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await seedSession(page);
    const { calls } = await stubApi(page);
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Public navigation" });
    await expect(nav.getByRole("link", { name: "Open NeueBit", exact: true })).toBeVisible();
    const signedIn = await geometry(page);
    await nav.getByRole("button", { name: "Log out", exact: true }).click();
    await expect(nav.getByRole("link", { name: "Get started", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign in", exact: true })).toHaveAttribute("href", "/auth?mode=login");
    const signedOut = await geometry(page);
    for (const state of [signedIn, signedOut]) {
      expect(state.nav.x).toBe(0);
      expect(state.nav.width).toBe(width);
      expect(Math.abs(state.links.x + state.links.width / 2 - width / 2)).toBeLessThan(.5);
      expect(state.brand.x).toBeGreaterThanOrEqual(24);
      expect(state.brand.x).toBeLessThanOrEqual(32);
      expect(width - state.actions.right).toBeGreaterThanOrEqual(24);
      expect(width - state.actions.right).toBeLessThanOrEqual(32);
      expect(state.brand.right).toBeLessThan(state.links.x);
      expect(state.links.right).toBeLessThan(state.actions.x);
      expect(state.mark.width).toBeGreaterThanOrEqual(28);
      expect(state.mark.width).toBeLessThanOrEqual(32);
      expect(state.nav.height).toBeGreaterThanOrEqual(64);
      expect(state.nav.height).toBeLessThanOrEqual(72);
      expect(state.primary.height).toBeGreaterThanOrEqual(40);
      expect(state.primary.height).toBeLessThanOrEqual(44);
    }
    expect(signedOut.links.x).toBeCloseTo(signedIn.links.x, 2);
    expect(signedOut.links.width).toBeCloseTo(signedIn.links.width, 2);
    const beforeScroll = await page.getByRole("banner").boundingBox();
    await nav.getByRole("link", { name: "Product", exact: true }).click();
    await expect(page.locator("#product")).toBeFocused();
    const afterScroll = await page.getByRole("banner").boundingBox();
    expect(afterScroll!.height).toBe(beforeScroll!.height);
    expect(afterScroll!.y).toBe(0);
    expect(calls.map(call => call.path)).toEqual(["/auth/me"]);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`navbar adapts without collisions at normal and enlarged text in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await stubApi(page);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) for (const size of ["100%", "200%"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(size => { document.documentElement.style.fontSize = size; }, size);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const controls = await page.locator(".marketing-nav").evaluate(nav => [...nav.querySelectorAll<HTMLElement>("a,button")]
        .filter(element => element.getClientRects().length > 0)
        .map(element => ({ label: element.textContent, ...element.getBoundingClientRect().toJSON() })));
      for (const control of controls) {
        expect(control.x, `${width}/${size}: ${control.label}`).toBeGreaterThanOrEqual(0);
        expect(control.right, `${width}/${size}: ${control.label}`).toBeLessThanOrEqual(width);
        expect(control.height).toBeGreaterThanOrEqual(44);
      }
      const compact = width <= 1056 || size === "200%";
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeVisible({ visible: compact });
      if (!compact) {
        const state = await geometry(page);
        expect(state.links.right).toBeLessThan(state.actions.x);
        expect(Math.abs(state.links.x + state.links.width / 2 - width / 2)).toBeLessThan(.5);
      }
    }
    const toggle = page.getByRole("button", { name: /^(Open|Close) navigation$/ });
    await toggle.focus(); await page.keyboard.press("Enter");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const appearance = page.locator("#public-mobile-links").getByRole("button", { name: /Switch to .* theme/ });
    await appearance.focus(); await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme === "light" ? "dark" : "light");
    await page.keyboard.press("Escape");
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
}

test("focus follows a desktop control into the compact menu on text enlargement", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page); await page.goto("/");
  await page.locator(".marketing-nav-desktop").getByRole("link", { name: "Product", exact: true }).focus();
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});

test("the longest pending-session label fits the desktop lanes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seedSession(page);
  const release = deferred();
  await stubApi(page, { "/auth/me": async route => { await release.promise; await reply(route, USER); } });
  await page.goto("/");
  try {
    await expect(page.locator(".marketing-nav-access").getByRole("link", { name: "Continue to NeueBit" })).toBeVisible();
    for (const width of [1057, 1100, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const state = await geometry(page);
      expect(state.links.right).toBeLessThan(state.actions.x);
    }
  } finally { release.resolve(); }
  await expect(page.locator(".marketing-nav-access").getByRole("link", { name: "Open NeueBit" })).toBeVisible();
});
