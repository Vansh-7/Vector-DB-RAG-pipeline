import { test, expect, seedSession, stubApi } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

for (const theme of ["light", "dark"] as const) {
  for (const width of [390, 1440]) {
    test(`${theme} brand showcase at ${width}px preserves sizes, names, and contrast`, async ({ page }, testInfo) => {
      await appearance(page, theme);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/brand");
      await expect(page).toHaveTitle("NeueBit - Brand");
      await expect(page.getByRole("img", { name: "NeueBit on white", exact: true })).toHaveCount(1);
      await expect(page.getByRole("img", { name: "NeueBit on white", exact: true })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(page.getByRole("img", { name: "NeueBit on charcoal", exact: true })).toHaveCount(1);
      const titleIds = await page.locator("svg.neuebit-logo title").evaluateAll((titles) => titles.map((title) => title.id));
      expect(new Set(titleIds).size).toBe(titleIds.length);
      await expect(page.locator("svg.neuebit-logo[aria-hidden=true] title")).toHaveCount(0);

      for (const variant of ["light", "dark"] as const) {
        const samples = page.getByLabel(`${variant} size samples`).locator("svg");
        for (const [i, size] of [16, 24, 32, 40, 64, 128].entries()) {
          const svg = samples.nth(i);
          await expect(svg).toHaveCSS("width", `${size}px`);
          await expect(svg).toHaveCSS("height", `${size}px`);
          await expect(svg.locator("path")).toHaveCSS("fill", variant === "light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
        }
      }
      const currentMark = page.locator(".brand-showcase__home svg");
      await expect(currentMark.locator("path")).toHaveCSS("fill", theme === "light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
      await expect(currentMark).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      await expect(page.locator(".brand-showcase__app-header svg")).toHaveCSS("width", "20px");
      await page.evaluate(() => document.fonts.ready);
      for (const brand of await page.locator(".neuebit-brand").all()) {
        const mark = (await brand.locator("svg").boundingBox())!;
        const name = (await brand.locator(".neuebit-brand__name").boundingBox())!;
        const fontSize = await brand.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
        // Keep the lettering subordinate to the mark; equal cap-height scaling inflated it.
        expect(fontSize / mark.height).toBeGreaterThan(.75);
        expect(fontSize / mark.height).toBeLessThan(.95);
        expect(Math.abs((mark.y + mark.height / 2) - (name.y + name.height / 2))).toBeLessThan(.1);
        expect(name.x - (mark.x + mark.width)).toBeGreaterThan(mark.height * .3);
        expect(name.x - (mark.x + mark.width)).toBeLessThan(mark.height * .5);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`brand-${theme}-${width}.png`), fullPage: true });

      await page.getByRole("button", { name: `Switch to ${theme === "light" ? "dark" : "light"} theme` }).click();
      await expect(currentMark.locator("path")).toHaveCSS("fill", theme === "light" ? "rgb(255, 255, 255)" : "rgb(0, 0, 0)");
      await expect(page.getByRole("img", { name: "NeueBit on white", exact: true }).locator("path")).toHaveCSS("fill", "rgb(0, 0, 0)");
    });
  }
}

test("standalone SVG, favicon, and React share the same contour and transparent cutouts", async ({ page, request }) => {
  const raw = await (await request.get("/brand/neuebit-mark.svg")).text();
  const favicon = await (await request.get("/favicon.svg")).text();
  expect(favicon).toBe(raw);
  expect(raw).not.toMatch(/<(image|filter|rect|linearGradient|radialGradient)\b/);
  await page.goto("/brand");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/brand/neuebit-mark.svg");
  const path = page.locator(".brand-showcase__home path");
  await expect(path).toHaveAttribute("d", raw.match(/\bd="([^"]+)"/)![1]);
  await expect(path).toHaveAttribute("fill-rule", "evenodd");

  // Render the distributable itself in the browser, including its OS-theme fallback.
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/brand/neuebit-mark.svg");
    await expect(page.locator("path")).toHaveCSS("fill", theme === "light" ? "rgb(0, 0, 0)" : "rgb(255, 255, 255)");
  }
});

test("shared mark reaches landing, auth, and the authenticated sidebar", async ({ page }) => {
  await appearance(page, "dark");
  await stubApi(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "NeueBit home" }).locator("svg.neuebit-logo path")).toHaveCSS("fill", "rgb(255, 255, 255)");
  await page.goto("/auth");
  await expect(page.locator(".neuebit-brand__name")).toHaveText("NeueBit");
  await seedSession(page);
  await page.goto("/app");
  const sidebarMark = page.getByRole("complementary", { name: "Primary sidebar" }).locator("svg.neuebit-logo");
  await expect(sidebarMark).toHaveCSS("width", "20px");
  await expect(sidebarMark).toHaveCSS("filter", "none");
  await expect(sidebarMark.locator("path")).toHaveCSS("fill", "rgb(255, 255, 255)");
});
