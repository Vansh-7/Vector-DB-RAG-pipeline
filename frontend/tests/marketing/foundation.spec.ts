import {
  test, expect, stubApi, fillCredentials, expectWorkspace, expectNoProductCode,
} from "../entry/fixtures";

for (const width of [320, 375, 768, 1024, 1280, 1440]) {
  test(`marketing base at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const { calls, scripts } = await stubApi(page);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(fits, "No horizontal overflow").toBe(true);
    for (const link of await page.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box!.height, "CTA has a 44px touch target").toBeGreaterThanOrEqual(44);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await page.keyboard.press("Tab");
    const primary = page.getByRole("link", { name: "Get started" });
    await expect(primary).toBeFocused();
    const focus = await primary.evaluate((element) => getComputedStyle(element).outlineStyle);
    expect(focus).toBe("solid");
    expect(calls).toEqual([]);
    expectNoProductCode(scripts);
    if (width === 375 || width === 1440) {
      // Review the base page without displaying a keyboard focus ring in the capture.
      await primary.evaluate((element) => (element as HTMLElement).blur());
      await page.screenshot({ path: test.info().outputPath("base-page.png"), fullPage: true });
    }
  });
}

test("public page scrolls with the document and public-to-app navigation isolates themes", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await page.evaluate(() => {
    // Simulate future below-fold sections without shipping placeholder content.
    const continuation = document.createElement("div");
    continuation.style.height = "1600px";
    continuation.setAttribute("aria-hidden", "true");
    document.querySelector("main")!.appendChild(continuation);
  });
  await page.mouse.wheel(0, 500);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  expect(await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(250, 249, 246)");
  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  const productBody = await page.locator("body").evaluate((element) => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, overflow: styles.overflow, scheme: styles.colorScheme };
  });
  expect(productBody).toEqual({ background: "rgb(17, 18, 19)", overflow: "hidden", scheme: "dark" });
  await fillCredentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectWorkspace(page);
  await expect(page.locator(".marketing-page")).toHaveCount(0);
  expect(await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(productBody.background);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("link", { name: "Back to Neuebit" }).click();
  await expect(page.getByRole("heading", { name: "Your knowledge, in context." })).toBeVisible();
  expect(await page.locator("body").evaluate((element) => getComputedStyle(element).colorScheme)).toBe("light");
});

test("text at 200% size stays legible and controls remain reachable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await stubApi(page);
  await page.goto("/");
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("reduced motion keeps all content and navigation usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page);
  await page.goto("/");
  const primary = page.getByRole("link", { name: "Get started" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const duration = await primary.evaluate((element) => getComputedStyle(element).transitionDuration);
  expect(duration.split(",").every((value) => parseFloat(value) < 0.001)).toBe(true);
  await primary.click();
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});
