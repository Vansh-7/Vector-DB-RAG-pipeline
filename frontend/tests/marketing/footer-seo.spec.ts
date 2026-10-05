import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadConfigFromFile, type Plugin } from "vite";
import { test, expect, stubApi, expectNoProductCode, seedSession, expectWorkspace } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";
import { LANDING_DESCRIPTION, LANDING_TITLE, publicSiteUrl } from "../../src/lib/siteMetadata";

for (const theme of ["light", "dark"] as const) for (const height of [900,960]) {
  test(`${theme} closing chapter fits 1440x${height} with a viewport-wide divider`, async ({page}) => {
    await page.setViewportSize({width:1440,height}); await appearance(page,theme,theme);
    await page.emulateMedia({reducedMotion:"reduce"}); await stubApi(page); await page.goto("/");
    const close=page.locator(".landing-close"), footer=page.getByRole("contentinfo");
    await close.scrollIntoViewIfNeeded(); await page.evaluate(()=>document.fonts.ready);
    const header=(await page.getByRole("banner").boundingBox())!;
    const whole=(await close.boundingBox())!, edge=(await footer.boundingBox())!;
    expect(whole.height).toBeLessThanOrEqual(height-header.height+1);
    expect(whole.y).toBeGreaterThanOrEqual(header.height-1);
    expect(whole.y+whole.height).toBeLessThanOrEqual(height+1);
    expect(edge.x).toBe(0); expect(edge.width).toBe(1440);
    await expect(footer).toHaveCSS("border-top-width","1px");
    await expect(footer.locator(".marketing-footer-content")).toHaveCSS("border-top-width","0px");
    const actions=(await close.locator(".marketing-closing-actions").boundingBox())!;
    expect(edge.y-actions.y-actions.height).toBeGreaterThanOrEqual(48);
    expect(edge.y-actions.y-actions.height).toBeLessThanOrEqual(64);
    const utility=(await footer.locator(".marketing-footer-attribution").boundingBox())!;
    expect(utility.y+utility.height).toBeLessThan(height);
    await expect(close.locator(".footer-wordmark")).toHaveCount(0);
    await expect(close.locator(".closing-motif, .marketing-final-cta svg:not(.lucide)")).toHaveCount(0);
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} closing CTA and footer reflow from 320px to desktop and 200% text`, async ({ page }) => {
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls, scripts } = await stubApi(page);
    await page.goto("/");
    const closing = page.getByRole("region", { name: "Ready to work with your knowledge?" });
    const footer = page.getByRole("contentinfo");
    for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const size of ["100%", "200%"]) {
        await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, size);
        await footer.scrollIntoViewIfNeeded();
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const link of await footer.getByRole("link").all()) {
          const box = (await link.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
        }
        await expect(closing.locator(".marketing-container")).toHaveCSS("opacity", "1");
        await expect(closing.locator(".marketing-container")).toHaveCSS("transform", "none");
        if (width < 600) {
          const actions = (await closing.locator(".marketing-closing-actions").boundingBox())!;
          for (const link of await closing.getByRole("link").all()) expect((await link.boundingBox())!.width).toBeCloseTo(actions.width, 0);
        }
      }
    }
    await expect(footer).toHaveCSS("background-color", theme === "light" ? "rgb(255, 255, 255)" : "rgb(8, 9, 10)");
    await expect(footer).toContainText("Built by Vansh Gupta");
    expect(calls).toEqual([]);
    expectNoProductCode(scripts);
  });
}

test("footer navigation scrolls locally without changing local story state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  await expect(page.locator(".retrieval-canvas")).toBeAttached();
  const footer = page.getByRole("contentinfo");
  const product = footer.getByRole("navigation", { name: "Footer product navigation" });
  await expect(product.getByRole("link")).toHaveText(["Chat", "Documents", "Search", "Vector Lab"]);
  for (const name of ["Chat", "Documents", "Search", "Vector Lab"]) {
    await product.getByRole("link", { name, exact: true }).click();
    const id = name === "Vector Lab" ? "vector-lab" : `knowledge-${name.toLowerCase()}`;
    await expect(page.locator(`#${id}`)).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`/#${id}$`));
    await expect(page.locator(".retrieval-canvas")).toHaveAttribute("data-retrieval-stage", "5");
  }
  await footer.getByRole("link", { name: "Architecture" }).click();
  await expect(page.locator("#architecture")).toBeFocused();
  await footer.getByRole("link", { name: "NeueBit, back to top" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page).toHaveURL(/\/#hero-heading$/);
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/Vansh-7/Vector-DB-RAG-pipeline");
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
});

test("closing CTA uses the existing register and authenticated app boundaries", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page);
  await page.goto("/");
  const closing = page.getByRole("region", { name: "Ready to work with your knowledge?" });
  await expect(closing.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/auth?mode=register");
  await closing.getByRole("link", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
  await seedSession(page);
  await page.goto("/");
  await expect(closing.getByRole("link", { name: "Open NeueBit" })).toHaveAttribute("href", "/app");
  await closing.getByRole("link", { name: "Open NeueBit" }).click();
  await expectWorkspace(page);
  expect(await page.locator("html").evaluate((element) => (element as HTMLElement).style.getPropertyValue("--marketing-header-height"))).toBe("");
});

test("short mobile navigation remains scrollable and keyboard accessible with enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 360 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page);
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  const toggle = page.getByRole("button", { name: /^(Open|Close) navigation$/ });
  await toggle.focus();
  await page.keyboard.press("Enter");
  const menu = page.locator("#public-mobile-links");
  expect((await page.getByRole("banner").boundingBox())!.height).toBeLessThanOrEqual(360);
  for (let index = 0; index < 7; index++) {
    await page.keyboard.press("Tab");
    const target = page.locator(":focus");
    expect(await menu.evaluate((menu) => menu.contains(document.activeElement))).toBe(true);
    const box = (await target.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(360);
  }
  await expect(menu.getByRole("link", { name: "Get started" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/auth\?mode=register$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("static public metadata is readable without React and domainless previews are noindex", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const crawler = await context.newPage();
  try {
    await crawler.goto("/");
    await expect(crawler).toHaveTitle(LANDING_TITLE);
    await expect(crawler.locator('meta[name="description"]')).toHaveAttribute("content", LANDING_DESCRIPTION);
    await expect(crawler.locator('meta[property="og:title"]')).toHaveAttribute("content", LANDING_TITLE);
    await expect(crawler.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary");
    await expect(crawler.locator('link[rel="canonical"]')).toHaveCount(0);
    await expect(crawler.locator('meta[property="og:image"]')).toHaveCount(0);
    await expect(crawler.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  } finally { await context.close(); }
  for (const [path, width, height] of [["/social/neuebit-og.png", 1200, 630], ["/apple-touch-icon.png", 180, 180]] as const) {
    const response = await page.request.get(path);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.readUInt32BE(16)).toBe(width);
    expect(bytes.readUInt32BE(20)).toBe(height);
    expect(bytes.length).toBeLessThan(100000);
  }
});

test("configured origin injects absolute canonical and social metadata into static HTML", async ({ browser }) => {
  const previous = process.env.VITE_PUBLIC_SITE_URL;
  let html: string;
  try {
    process.env.VITE_PUBLIC_SITE_URL = "https://neuebit.example";
    const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, resolve("vite.config.ts"));
    const plugin = loaded!.config.plugins!.flat(2).find((plugin) => plugin && typeof plugin === "object" && "name" in plugin && plugin.name === "neuebit-public-metadata") as Plugin;
    const hook = plugin.transformIndexHtml;
    if (!hook || typeof hook !== "object") throw new Error("Expected the static metadata transform");
    const output = await hook.handler(await readFile("index.html", "utf8"), { path: "/", filename: resolve("index.html") });
    if (typeof output !== "string") throw new Error("Expected transformed HTML");
    html = output;
  } finally {
    if (previous === undefined) delete process.env.VITE_PUBLIC_SITE_URL; else process.env.VITE_PUBLIC_SITE_URL = previous;
  }
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.setContent(html);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "index, follow");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://neuebit.example/");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", "https://neuebit.example/");
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://neuebit.example/social/neuebit-og.png");
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", "https://neuebit.example/social/neuebit-og.png");
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", /NeueBit.*custom vector engine/);
  } finally { await context.close(); }
  expect(publicSiteUrl(undefined)).toBeNull();
  expect(publicSiteUrl("https://neuebit.example/")).toBe("https://neuebit.example/");
  for (const url of ["http://neuebit.example", "https://neuebit.example/app", "https://neuebit.example/?query=1", "https://name:secret@neuebit.example", "https://neuebit.example/#section"]) {
    expect(() => publicSiteUrl(url)).toThrow();
  }
});

test("metadata follows public, auth, private app, and missing-page navigation without duplication", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await expect(page).toHaveTitle(LANDING_TITLE);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveTitle("NeueBit - Sign in");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Sign in to your NeueBit knowledge workspace.");
  await expect(page.locator("[data-public-metadata]")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await page.goto("/auth?mode=register");
  await expect(page).toHaveTitle("NeueBit - Create account");
  await page.getByRole("link", { name: "Back to NeueBit" }).click();
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", LANDING_DESCRIPTION);
  await page.goto("/missing-page");
  await expect(page).toHaveTitle("NeueBit - Page not found");
  await expect(page.locator("[data-public-metadata]")).toHaveCount(0);
  await seedSession(page);
  await page.goto("/app");
  await expectWorkspace(page);
  await expect(page).toHaveTitle("NeueBit - Workspace");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "Your private NeueBit knowledge workspace.");
  await page.goto("/");
  await expect(page).toHaveTitle(LANDING_TITLE);
  await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
});
