import { test, expect, reply, stubApi, fillCredentials, expectWorkspace } from "./fixtures";

test("requirements transition both ways without hostile initial errors", async ({ page }) => {
  const { calls } = await stubApi(page);
  await page.goto("/auth?mode=register");
  const requirements = page.getByRole("list", { name: "Password requirements" });
  const password = page.getByLabel("Password", { exact: true });
  await expect(requirements.locator('[data-met="false"]')).toHaveCount(5);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator("#auth-confirm-status")).toBeEmpty();
  for (const [value, count] of [["a", 1], ["aA", 2], ["aA1", 3], ["aA1!", 4], ["aA1!aaaa", 5], ["aaaaaaa1!", 4], ["aaaaaaaa", 2], ["", 0]] as const) {
    await password.fill(value);
    await expect(requirements.locator('[data-met="true"]')).toHaveCount(count);
  }
  await fillCredentials(page);
  await password.fill("aaaaaaaa");
  await page.getByLabel("Confirm password", { exact: true }).fill("aaaaaaaa");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Choose a password that meets all five requirements.");
  await expect(password).toBeFocused();
  expect(calls).toEqual([]);
});

test("confirmation reserves space, stays quiet when empty, and follows password edits", async ({ page }) => {
  await stubApi(page);
  await page.goto("/auth?mode=register");
  await fillCredentials(page);
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  const feedback = page.locator("#auth-confirm-status");
  const submit = page.getByRole("button", { name: "Create account", exact: true });
  const before = await submit.boundingBox();
  await confirmation.focus();
  await confirmation.blur();
  await expect(feedback).toBeEmpty();
  await confirmation.fill("Different-password1!");
  await expect(feedback).toHaveText("Passwords do not match.");
  await expect(confirmation).toHaveAttribute("aria-invalid", "true");
  await confirmation.fill("Neuebit-test-123!");
  await expect(feedback).toHaveText("Passwords match.");
  await expect(confirmation).toHaveAttribute("aria-invalid", "false");
  await page.getByLabel("Password", { exact: true }).fill("Other-password1!");
  await expect(feedback).toHaveText("Passwords do not match.");
  await confirmation.fill("");
  await expect(feedback).toBeEmpty();
  expect((await submit.boundingBox())?.y).toBe(before?.y);
});

test("password visibility preserves pointer focus and works from the keyboard", async ({ page }) => {
  await stubApi(page);
  await page.goto("/auth?mode=register");
  await fillCredentials(page);
  const password = page.getByLabel("Password", { exact: true });
  await password.focus();
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await expect(password).toBeFocused();
  await expect(password).toHaveAttribute("type", "text");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Hide password", exact: true })).toBeFocused();
  await page.keyboard.press("Space");
  await expect(password).toHaveAttribute("type", "password");
  await page.keyboard.press("Tab");
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await expect(confirmation).toBeFocused();
  await confirmation.fill("Neuebit-test-123!");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Show confirmation password" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(confirmation).toHaveAttribute("type", "text");
  await page.keyboard.press("Space");
  await expect(confirmation).toHaveAttribute("type", "password");
});

test("Enter submits login with an existing password and correct autocomplete", async ({ page }) => {
  await stubApi(page);
  await page.goto("/auth?mode=login");
  await fillCredentials(page);
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("autocomplete", "email");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await password.fill("legacy-password");
  await password.press("Enter");
  await expectWorkspace(page);
});

test("Enter submits registration with new-password autocomplete", async ({ page }) => {
  await stubApi(page);
  await page.goto("/auth?mode=register");
  await fillCredentials(page);
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
  const confirmation = page.getByLabel("Confirm password", { exact: true });
  await expect(confirmation).toHaveAttribute("autocomplete", "new-password");
  await confirmation.fill("Neuebit-test-123!");
  await confirmation.press("Enter");
  await expectWorkspace(page);
});

for (const [status, detail, message] of [
  [409, "SQLAlchemy: duplicate users_email constraint", "An account with this email already exists. Sign in instead."],
  [422, [{ loc: ["body", "password"], msg: "ValueError: internal password validator" }], "This password was rejected. Check the requirements and try another."],
  [422, [{ loc: ["body", "email"], msg: "internal email-validator details" }], "Enter a valid email address."],
  [500, "Traceback: database password=private", "Unable to connect. Please try again in a moment."],
] as const) {
  test(`registration handles ${status} safely: ${message}`, async ({ page }) => {
    const { calls } = await stubApi(page, { "/auth/register": (route) => reply(route, { detail }, status) });
    await page.goto("/auth?mode=register");
    await fillCredentials(page);
    await page.getByLabel("Confirm password", { exact: true }).fill("Neuebit-test-123!");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeEnabled();
    expect(calls.map(({ path }) => path)).toEqual(["/auth/register"]);
  });
}

test("invalid email stays local and network failure leaves the form usable", async ({ page }) => {
  const { calls } = await stubApi(page, { "/auth/login": (route) => route.abort("failed") });
  await page.goto("/auth?mode=login");
  await fillCredentials(page);
  await page.getByLabel("Email", { exact: true }).fill("invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Enter a valid email address.");
  expect(calls).toEqual([]);
  await page.getByLabel("Email", { exact: true }).fill("user@example.com");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Unable to connect. Please try again in a moment.");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

for (const width of [1440, 1024, 768, 430, 390, 375, 320]) {
  test(`auth layout fits ${width}px in both modes and themes`, async ({ page }) => {
    await stubApi(page);
    await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
    for (const mode of ["login", "register"]) {
      await page.goto(`/auth?mode=${mode}`);
      for (const theme of ["light", "dark"]) {
        if (await page.locator("html").getAttribute("data-theme") !== theme) {
          await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
        }
        await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
        const screen = await page.locator(".auth-screen").evaluate((element) => ({ client: element.clientWidth, scroll: element.scrollWidth }));
        expect(screen.scroll).toBe(screen.client);
        const stack = await page.locator(".auth-stack").boundingBox();
        expect(stack!.width).toBe(width < 458 ? width - 40 : 410);
        expect(stack!.x).toBeGreaterThanOrEqual(20);
        expect(stack!.x + stack!.width).toBeLessThanOrEqual(width - 20);
        if (width < 640) expect(stack!.y).toBe(80);
        else expect(stack!.y + stack!.height / 2).toBeLessThan(450);
        for (const input of await page.locator(".auth-input").all()) expect((await input.boundingBox())!.height).toBe(48);
        await expect(page.getByRole("button", { name: /Google|Apple|Microsoft|ChatGPT|SSO|Passkey/ })).toHaveCount(0);
        if (process.env.AUTH_CAPTURE_DIR && (width === 1440 || width === 375)) {
          await page.getByRole("heading").focus();
          await page.mouse.move(0, 0);
          await page.screenshot({ path: `${process.env.AUTH_CAPTURE_DIR}/auth-${mode}-${theme}-${width}.png` });
        }
      }
    }
  });
}
