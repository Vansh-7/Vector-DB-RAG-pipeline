import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

test("one product story starts with Documents and has no competing playground or distant controls", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your knowledge, in context.");
  await expect(page.locator("#product")).toHaveCount(1);
  await expect(page.getByRole("tab")).toHaveCount(3);
  await expect(page.getByRole("tab")).toHaveText(["01Add knowledgeDocuments", "02Find contextSearch", "03Ask + verifyChat + Sources"]);
  await expect(page.getByRole("tab", { name: /Add knowledge/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /^Try / })).toHaveCount(0);
  await expect(page.locator(".marketing-hero .demo-shell, .product-story, .demo-navigation, .demo-prompts")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Vector Lab" })).toHaveAttribute("href", "#vector-lab");
  expect((await page.locator(".tour-navigation").boundingBox())!.y).toBeLessThan(900);
  const hero = (await page.locator(".marketing-hero").boundingBox())!;
  const tour = (await page.locator("#product").boundingBox())!;
  expect(tour.y - hero.y - hero.height).toBeLessThanOrEqual(1);
  expect(calls).toEqual([]); expectNoProductCode(scripts);
});

test("Documents → Search → Chat gives local feedback, honest sources, and no change to navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { calls, scripts } = await stubApi(page);
  await page.goto("/#product");
  const tour = page.locator("#product");
  await expect(tour.locator(".demo-document-row")).toHaveCount(3);
  await expect(tour.locator(".demo-chunks")).toHaveText(["6 passages", "8 passages", "6 passages"]);
  await tour.getByRole("button", { name: /Vector search notes/ }).click();
  await expect(tour.getByRole("complementary")).toContainText("Sample chunks8");
  await expect(tour.getByRole("complementary")).toContainText("Markdown");
  await expect(tour.getByRole("button", { name: /upload|delete/i })).toHaveCount(0);
  await tour.getByRole("tab", { name: /Find context/ }).click();
  await expect(tour.locator(".demo-search-query")).toContainText("retrieval");
  await expect(tour.locator(".demo-result-row")).toHaveCount(3);
  await tour.locator(".demo-result-row").nth(1).click();
  await expect(tour.locator(".demo-result-row").nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(tour.getByRole("complementary")).toContainText("Demo cosine distance");
  await tour.getByRole("tab", { name: /Ask \+ verify/ }).click();
  await expect(tour.locator(".demo-question")).toHaveText("How does retrieval work?");
  await expect(tour.locator(".demo-answer-text")).toContainText("Neuebit embeds your question");
  await tour.getByRole("button", { name: "2 sources" }).click();
  const sources = tour.getByRole("complementary", { name: "Preview answer sources" });
  await sources.getByRole("button", { name: /Source 2/ }).click();
  await expect(sources).toContainText("Source 2 → Answer passage 2");
  await expect(sources).toContainText("authored example");
  await expect(tour.locator('[data-answer-sentence="2"]')).toHaveAttribute("data-supported", "true");
  await expect(tour.locator('[data-answer-sentence="1"]')).toHaveAttribute("data-supported", "false");
  await expect(tour.locator(".demo-grounding-connector path")).toHaveCount(1);
  await expect(tour.locator(".demo-grounding-connector path")).toHaveCSS("animation-name", "none");
  await expect(page).toHaveURL(/\/#product$/);
  await expect(tour).toContainText("Fixed answers. No live AI.");
  expect(calls).toEqual([]); expectNoProductCode(scripts);
});

test("roving tabs and source disclosure support the keyboard without moving focus to another section", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page); await page.goto("/#product");
  const tabs = page.getByRole("tab");
  await tabs.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("End");
  await expect(tabs.nth(2)).toBeFocused();
  await expect(tabs.nth(2)).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("tabpanel")).toBeFocused();
  await page.keyboard.press("Tab");
  const trigger = page.getByRole("button", { name: "2 sources" });
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Close preview sources" })).toBeFocused();
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(page.locator('[data-answer-sentence="2"]')).toHaveAttribute("data-supported", "true");
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await tabs.last().focus(); await page.keyboard.press("Home");
  await expect(tabs.first()).toBeFocused();
});

for (const theme of ["light", "dark"] as const) for (const width of [320, 375, 390, 430, 768, 1024]) {
  test(`${theme} ${width}px presents locally interactive stacked chapters and reflows 200% text`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls, scripts } = await stubApi(page); await page.goto("/");
    const layout = page.locator(".tour-layout");
    await expect(layout).toHaveAttribute("data-tour-layout", "chapters");
    await expect(layout.getByRole("article")).toHaveCount(3);
    await expect(layout.getByRole("tab")).toHaveCount(0);
    const documents = layout.getByRole("article", { name: "Add knowledge" });
    const search = layout.getByRole("article", { name: "Find context" });
    const chat = layout.getByRole("article", { name: "Ask + verify" });
    await documents.locator(".demo-document-row").nth(2).click();
    await expect(documents.getByRole("complementary")).toContainText("RAG design.md");
    await search.locator(".demo-result-row").nth(2).click();
    await expect(search.locator(".demo-result-row").nth(2)).toHaveAttribute("aria-pressed", "true");
    await chat.getByRole("button", { name: "2 sources" }).click();
    await chat.getByRole("button", { name: /Source 2/ }).click();
    await expect(chat.locator('[data-answer-sentence="2"]')).toHaveAttribute("data-supported", "true");
    for (const size of ["100%", "200%"]) {
      await page.evaluate((size) => { document.documentElement.style.fontSize = size; }, size);
      await expect(layout).toHaveAttribute("data-tour-layout", "chapters");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const inspector = (await chat.getByRole("complementary").boundingBox())!;
      expect(inspector.x).toBeGreaterThanOrEqual(0); expect(inspector.x + inspector.width).toBeLessThanOrEqual(width);
      await page.getByRole("combobox", { name: "Choose a sample vector" }).selectOption("sample-2");
      await expect(page.getByRole("complementary", { name: "Preview vector inspector" })).toContainText("sample-2");
      expect((await page.getByRole("combobox", { name: "Choose a sample vector" }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    expect(calls).toEqual([]); expectNoProductCode(scripts);
  });
}

test("desktop enlarged text becomes stacked chapters and all source content stays available", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto("/");
  await expect(page.locator(".tour-layout")).toHaveAttribute("data-tour-layout", "stage");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await expect(page.locator(".tour-layout")).toHaveAttribute("data-tour-layout", "chapters");
  await page.getByRole("button", { name: "2 sources" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".demo-grounding-connector")).toHaveCount(0);
});

test("tour and vector controls cannot change each other's state or scroll position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto("/");
  await page.getByRole("tab", { name: /Find context/ }).click();
  await page.locator("#vector-lab").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await page.getByRole("button", { name: "Exact", exact: true }).click();
  await page.getByRole("combobox", { name: "Choose a sample vector" }).selectOption("sample-3");
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
  await expect(page.getByRole("tab", { name: /Find context/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("navigation", { name: "Public navigation" }).getByRole("link", { name: "Product", exact: true }).click();
  await page.getByRole("tab", { name: /Ask \+ verify/ }).click();
  await expect(page.getByRole("button", { name: "Exact", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("complementary", { name: "Preview vector inspector" })).toContainText("sample-3");
});

test("saved answer reveals once without autoplaying chapters or scrolling the visitor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" }); await stubApi(page); await page.goto("/#product");
  await page.getByRole("tab", { name: /Ask \+ verify/ }).click();
  const chat = page.locator(".demo-chat");
  await chat.scrollIntoViewIfNeeded();
  const position = await page.evaluate(() => scrollY);
  await expect(chat).toHaveAttribute("data-chat-phase", "2");
  await expect(chat.locator(".demo-source-trigger")).toHaveCSS("opacity", "1");
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(position, 0);
  await chat.getByRole("button", { name: "2 sources" }).click();
  await expect(chat.locator(".demo-grounding-connector path")).toHaveCSS("animation-duration", "0.6s");
  await expect(chat.locator(".demo-grounding-connector path")).toHaveCSS("stroke-dashoffset", "0px");
  await expect(page.getByRole("tab", { name: /Ask \+ verify/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: /Find context/ }).click();
  await expect(page.locator(".demo-chat")).toHaveCount(0);
  await page.getByRole("tab", { name: /Add knowledge/ }).click();
  await expect(page.locator(".demo-document-row")).toHaveCount(3);
});

for (const id of ["product", "product-story"]) test(`direct #${id} survives lazy mounting and refresh`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto(`/#${id}`);
  const target = page.locator("#product");
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(130);
  await page.reload();
  await expect.poll(() => target.evaluate((element) => element.getBoundingClientRect().top)).toBeLessThan(130);
});
