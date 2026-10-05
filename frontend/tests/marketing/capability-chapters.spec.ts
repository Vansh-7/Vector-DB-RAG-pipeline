import type { Page } from "@playwright/test";
import { test, expect, stubApi } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

const viewports = [[1440, 900], [1366, 768], [1280, 800], [1024, 768], [768, 1024], [390, 844]];

async function expectContainedWindows(page: Page) {
  const issues = await page.locator("#knowledge-work").evaluate(section => {
    const problems: string[] = [];
    for (const element of section.querySelectorAll<HTMLElement>("*")) {
      const css = getComputedStyle(element);
      if (/auto|scroll/.test(css.overflowY)) problems.push(`nested scroll: ${element.className}`);
      if (css.scrollSnapType !== "none") problems.push(`scroll snap: ${element.className}`);
    }
    for (const window of section.querySelectorAll<HTMLElement>(".job-interface")) {
      if (window.scrollHeight > window.clientHeight + 1) problems.push(`window vertical overflow: ${window.className}`);
      if (window.scrollWidth > window.clientWidth + 1) problems.push(`window horizontal overflow: ${window.className}`);
    }
    if (document.documentElement.scrollWidth > innerWidth + 1) problems.push("page overflow");
    return problems;
  });
  expect(issues).toEqual([]);
}

for (const [width, height] of viewports) for (const theme of ["light", "dark"] as const) {
  test(`${width}x${height} ${theme}: capability windows finish within their chapter`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls } = await stubApi(page);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const grouping = await page.locator("#knowledge-work").evaluate(section => {
      const docs = section.querySelector<HTMLElement>("#knowledge-documents")!;
      const search = section.querySelector<HTMLElement>("#knowledge-search")!;
      const chat = section.querySelector<HTMLElement>("#knowledge-chat")!;
      const style = (element: HTMLElement) => ({ fill: getComputedStyle(element).backgroundColor, inset: getComputedStyle(element).paddingLeft });
      const rect = (element: Element) => element.getBoundingClientRect();
      return {
        gapAfterMarquee: rect(section.querySelector(".knowledge-heading")!).top - rect(document.querySelector(".capability-marquee")!).bottom,
        styles: [docs, search, chat].map(style),
        leftEdges: [rect(docs).left, rect(chat).left],
        rightEdges: [rect(search).right, rect(chat).right],
        innerLeftEdges: [rect(docs.querySelector(".knowledge-job-copy")!).left, rect(chat.querySelector(".knowledge-job-copy")!).left],
        relatedGap: rect(chat).top - rect(search).bottom,
      };
    });
    expect(grouping.gapAfterMarquee).toBeGreaterThanOrEqual(80);
    expect(grouping.styles[1]).toEqual(grouping.styles[0]);
    expect(grouping.styles[2]).toEqual(grouping.styles[0]);
    expect(grouping.leftEdges[1]).toBeCloseTo(grouping.leftEdges[0], 0);
    expect(grouping.rightEdges[1]).toBeCloseTo(grouping.rightEdges[0], 0);
    expect(grouping.innerLeftEdges[1]).toBeCloseTo(grouping.innerLeftEdges[0], 0);
    expect(grouping.relatedGap).toBeGreaterThanOrEqual(20);
    expect(grouping.relatedGap).toBeLessThanOrEqual(96);
    for (const anchor of [".knowledge-library-chapter", "#knowledge-chat"]) {
      await page.locator(anchor).evaluate(element => scrollTo({
        top: element.getBoundingClientRect().top + scrollY - parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height")), behavior: "instant",
      }));
      if (width >= 1024) {
        const fit = await page.locator(anchor).evaluate(element => ({
          bottom: element.getBoundingClientRect().bottom,
          windows: [...element.querySelectorAll(".job-interface")].map(window => window.getBoundingClientRect().bottom),
        }));
        expect(fit.bottom).toBeLessThanOrEqual(height + 1);
        for (const bottom of fit.windows) expect(bottom).toBeLessThanOrEqual(height - 16);
      }
    }
    const docs = page.locator("#knowledge-documents .job-documents button");
    await expect(docs).toHaveCount(3);
    for (let index = 0; index < 3; index++) {
      await docs.nth(index).click();
      await expect(page.locator(".job-document-detail")).toContainText(`${[6, 8, 6][index]} indexed passages`);
      await expectContainedWindows(page);
    }
    await expect(page.locator(".job-search-matches button")).toHaveCount(2);
    for (const button of await page.locator(".job-search-matches button").all()) {
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expectContainedWindows(page);
    }
    for (const name of ["Source 1", "Source 2"]) {
      const button = page.locator("#knowledge-chat").getByRole("button", { name, exact: true });
      await button.focus(); await page.keyboard.press("Enter");
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator('.job-answer [data-supported="true"]')).toHaveCount(1);
      await expectContainedWindows(page);
    }
    expect(calls).toEqual([]);
  });
}

test("200% text can grow and stack complete windows without clipping", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page); await page.goto("/");
  await page.addStyleTag({ content: "html { font-size: 200%; }" });
  await page.locator("#knowledge-work").scrollIntoViewIfNeeded();
  await expectContainedWindows(page);
  const columns = await page.locator(".knowledge-grid").evaluate(element => getComputedStyle(element).gridTemplateColumns.split(" ").length);
  expect(columns).toBe(1);
});
