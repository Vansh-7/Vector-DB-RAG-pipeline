import { gzipSync } from "node:zlib";
import { test, expect, stubApi, seedSession, expectWorkspace, expectNoProductCode } from "../entry/fixtures";

test("desktop navigation reaches the real preview and preserves browser history", async ({ page }) => {
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(nav.getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/Vansh-7/Vector-DB-RAG-pipeline");
  await nav.getByRole("link", { name: "Product", exact: true }).click();
  await expect(page).toHaveURL(/\/#product$/);
  await expect(page.locator("#product")).toBeFocused();
  await expect(page.locator(".marketing-header")).toHaveClass(/marketing-header--scrolled/);
  const frame = await page.locator(".retrieval-canvas").boundingBox();
  const header = await page.getByRole("banner").boundingBox();
  expect(frame!.y).toBeGreaterThanOrEqual(header!.height);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/#product$/);
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
});

test("mobile disclosure supports keyboard, Escape, and product navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /^(Open|Close) navigation$/ });
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(nav.getByRole("link", { name: "Product", exact: true })).toHaveCount(0);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(nav.getByRole("link", { name: "Product", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await nav.getByRole("link", { name: "Product", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#product")).toBeFocused();
  await expect(page).toHaveURL(/\/#product$/);
  await page.keyboard.press("Tab");
  await expect(page.locator("#product .retrieval-document")).toBeFocused();
});

test("mobile account links use the established auth modes", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.locator("#public-mobile-links").getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/auth\?mode=register$/);
  await page.goBack();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await nav.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});

test("changing to desktop closes the disclosure and preserves focus", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("navigation").getByRole("link", { name: "Product", exact: true }).focus();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("link", { name: "Neuebit home" })).toBeFocused();
  await page.setViewportSize({ width: 375, height: 900 });
  await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});

test("authenticated navigation offers Open Neuebit and no sign-in link", async ({ page }) => {
  await seedSession(page);
  await stubApi(page);
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Public navigation" });
  await expect(nav.getByRole("link", { name: "Open Neuebit" })).toHaveAttribute("href", "/app");
  await expect(nav.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
  await nav.getByRole("link", { name: "Open Neuebit" }).click();
  await expectWorkspace(page);
});

test("hero enters in sequence, settles, and does not replay on scroll", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const observed = { firstVisible: {} as Record<string, number>, maxTranslation: 0, minPreviewScale: 1 };
    (window as unknown as { heroMotion: typeof observed }).heroMotion = observed;
    function sample() {
      const parts = [...document.querySelectorAll<HTMLElement>("[data-hero-part]")];
      let completed = parts.length === 4;
      for (const part of parts) {
        const style = getComputedStyle(part);
        const opacity = Number(style.opacity);
        const name = part.dataset.heroPart!;
        if (opacity > 0.001 && observed.firstVisible[name] === undefined) observed.firstVisible[name] = performance.now();
        const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
        observed.maxTranslation = Math.max(observed.maxTranslation, Math.abs(matrix.m42));
        if (name === "preview") observed.minPreviewScale = Math.min(observed.minPreviewScale, matrix.m11);
        completed &&= opacity === 1 && style.transform === "none";
      }
      if (!completed) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  await stubApi(page);
  await page.goto("/");
  const parts = page.locator("[data-hero-part]");
  await expect(parts).toHaveCount(4);
  for (const part of await parts.all()) {
    await expect(part).toHaveCSS("opacity", "1");
    await expect(part).toHaveCSS("transform", "none");
  }
  const observed = await page.evaluate(() => (window as unknown as {
    heroMotion: { firstVisible: Record<string, number>; maxTranslation: number; minPreviewScale: number };
  }).heroMotion);
  await testInfo.attach("hero-motion", { body: JSON.stringify(observed, null, 2), contentType: "application/json" });
  expect(Object.keys(observed.firstVisible)).toEqual(["headline", "copy", "actions", "preview"]);
  expect(observed.firstVisible.copy).toBeGreaterThan(observed.firstVisible.headline);
  expect(observed.firstVisible.actions).toBeGreaterThan(observed.firstVisible.copy);
  expect(observed.maxTranslation).toBeLessThanOrEqual(24.1);
  expect(observed.minPreviewScale).toBeGreaterThanOrEqual(0.984);
  const stayedVisible = await page.evaluate(async () => {
    const parts = [...document.querySelectorAll<HTMLElement>("[data-hero-part]")];
    let visible = true;
    let frames = 0;
    return new Promise<boolean>((resolve) => {
      function sample() {
        if (frames === 0) window.scrollTo(0, document.body.scrollHeight);
        if (frames === 6) window.scrollTo(0, 0);
        visible &&= parts.every((part) => Number(getComputedStyle(part).opacity) === 1);
        if (++frames < 12) requestAnimationFrame(sample); else resolve(visible);
      }
      requestAnimationFrame(sample);
    });
  });
  expect(stayedVisible).toBe(true);
});

test("reduced motion completes the entire hero immediately and disables disclosure motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  for (const part of await page.locator("[data-hero-part]").all()) {
    await expect(part).toHaveCSS("opacity", "1");
    await expect(part).toHaveCSS("transform", "none");
  }
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.locator("#public-mobile-links")).toHaveCSS("animation-name", "none");
  await page.locator("#public-mobile-links").getByRole("link", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("mobile disclosure dismisses when focus or pointer leaves navigation", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /^(Open|Close) navigation$/ });
  await toggle.click();
  await page.locator(".marketing-hero").getByRole("link", { name: "Get started" }).focus();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await page.getByRole("heading", { level: 1 }).click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("skip link moves keyboard focus past the public navigation", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(/\/#main-content$/);
});

test("measure public JavaScript and keep marketing code off direct app entry", async ({ page }, testInfo) => {
  const { scripts, calls } = await stubApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Less looking/ })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Follow one question through Neuebit." })).toHaveCount(1);
  const assets = await Promise.all([...new Set(scripts)].map(async (url) => {
    const response = await page.request.get(url);
    return { asset: new URL(url).pathname, gzipBytes: gzipSync(await response.body()).length };
  }));
  const gzipBytes = assets.reduce((sum, item) => sum + item.gzipBytes, 0);
  await testInfo.attach("public-javascript", { body: JSON.stringify({ gzipBytes, assets }, null, 2), contentType: "application/json" });
  console.log(`Public entry JavaScript: ${(gzipBytes / 1024).toFixed(1)} KiB gzip (120 kB target, not a gate).`);
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
  scripts.length = 0;
  await seedSession(page);
  await page.goto("/app");
  await expectWorkspace(page);
  expect(scripts.filter((url) => /LandingPage-|LandingHero-|ProductTour-|EngineeringSection-|marketing-motion|domAnimation/.test(url))).toEqual([]);
});
