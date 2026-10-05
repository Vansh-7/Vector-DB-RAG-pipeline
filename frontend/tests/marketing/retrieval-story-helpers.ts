import type { Page } from "@playwright/test";

/** Seek the current sticky scroll clock or the complete natural-flow fallback. */
export async function seekStory(page: Page, progress: number) {
  await page.locator("#product").evaluate((section, progress) => {
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height"));
    const available = innerHeight - header;
    const top = (node: Element) => node.getBoundingClientRect().top + scrollY;
    const sectionTop = top(section) - header;
    const distance = Math.max(0, (section as HTMLElement).offsetHeight - available);
    scrollTo({ top: sectionTop + progress * distance, behavior: "instant" });
  }, progress);
  await page.waitForTimeout(100);
}
