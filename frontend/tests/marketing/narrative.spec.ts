import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

test("the required narrative has distinct sections and no repeated product tabs", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); const { calls, scripts } = await stubApi(page);
  await page.goto("/"); await expect(page.locator("#architecture")).toBeAttached();
  const sequence = await page.locator("main > section, main > .marketing-engineering > section, .landing-close > section").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-labelledby") || node.getAttribute("aria-label")));
  expect(sequence).toEqual(["hero-heading", "NeueBit capabilities", "knowledge-heading", "discovery-heading", "product-heading", "vector-reveal-heading", "architecture-heading", "final-cta-heading"]);
  await expect(page.locator(".marketing-hero").getByRole("tab")).toHaveCount(0);
  await expect(page.getByRole("tab")).toHaveCount(0);
  await expect(page.locator(".capability-discovery-links a")).toHaveCount(4);
  expect(calls).toEqual([]); expectNoProductCode(scripts);
});

test("job stories give local feedback and discovery only navigates", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto("/");
  const docs = page.locator("#knowledge-documents"), search = page.locator("#knowledge-search"), chat = page.locator("#knowledge-chat");
  await docs.getByRole("button", { name: /Vector search notes/ }).click();
  await expect(docs.locator(".job-document-detail")).toContainText("8 indexed passages");
  await search.getByRole("button").nth(1).click(); await expect(search.locator(".job-selected-match")).toContainText("sample-16");
  const answer = await chat.locator(".job-answer").textContent();
  await chat.getByRole("button", { name: "Source 2", exact: true }).click();
  await expect(chat.locator(".job-answer")).toHaveText(answer!);
  await expect(chat.locator('.job-answer [data-supported="true"]')).toContainText("reranks the matches");
  await expect(chat.locator(".job-source-excerpt")).toContainText("cross-encoder");
  await expect(page.locator(".retrieval-canvas")).toHaveAttribute("data-retrieval-stage", "5");
  await page.locator(".capability-discovery-links").getByRole("link", { name: "Search by meaning" }).click();
  await expect(search).toBeFocused(); await expect(search.getByRole("button").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(docs.getByRole("button", { name: /Vector search notes/ })).toHaveAttribute("aria-pressed", "true");
});

test("marquee supports explicit, hover and focus pause, plus static reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" }); await stubApi(page); await page.goto("/");
  const strip = page.locator(".capability-marquee"), track = strip.locator(".capability-marquee-track");
  const pause = strip.locator(".marquee-pause");
  await pause.click(); await page.mouse.move(0, 0); await pause.evaluate((button) => button.blur());
  await expect(track).toHaveCSS("animation-play-state", "paused");
  await strip.getByRole("button", { name: "Resume capability movement" }).click();
  await page.mouse.move(0, 0); await pause.evaluate((button) => button.blur());
  await expect(track).toHaveCSS("animation-play-state", "running");
  await strip.hover(); await expect(track).toHaveCSS("animation-play-state", "paused");
  await page.mouse.move(0, 0); await pause.focus(); await expect(track).toHaveCSS("animation-play-state", "paused");
  await page.emulateMedia({ reducedMotion: "reduce" }); await expect(track).toHaveCSS("animation-name", "none");
  await expect(strip.locator('ul:not([aria-hidden]) li')).toHaveCount(13);
});

for (const theme of ["light", "dark"] as const) test(`${theme} marketing actions have accessible blue contrast`, async ({ page }) => {
  await appearance(page, theme, theme); await stubApi(page); await page.goto("/");
  const action = page.locator(".marketing-hero .marketing-button--primary");
  const contrast = await action.evaluate((element) => {
    const luminance = (value: string) => {
      const channels = value.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((v) => v / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
    };
    const css = getComputedStyle(element), a = luminance(css.color), b = luminance(css.backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});
