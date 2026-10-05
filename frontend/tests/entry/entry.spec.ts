import {
  test, expect, USER, TOKEN_KEY, SESSION_TOKEN, deferred, reply, seedSession,
  stubApi, fillCredentials, expectWorkspace, expectNoProductCode,
} from "./fixtures";

test("public entry is usable without a session, product code, or product polling", async ({ page }) => {
  const { calls, scripts } = await stubApi(page);
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your knowledge, in context." })).toBeFocused();
  await expect(page).toHaveTitle("NeueBit — Your knowledge, in context");
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/auth?mode=register");
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth?mode=login");
  await page.clock.fastForward(30_000);
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Pause supporting phrases" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeFocused();
  await expect(page).toHaveURL(/\/auth\?mode=register$/);
});

test("public session restoration preserves the page and visitor focus", async ({ page }) => {
  const restore = deferred();
  await seedSession(page);
  const { calls, scripts } = await stubApi(page, { "/auth/me": async (route) => {
    await restore.promise;
    await reply(route, USER);
  } });
  await page.clock.install();
  await page.goto("/");
  const open = page.locator(".marketing-hero").getByRole("link", { name: "Continue to NeueBit" });
  await open.focus();
  await expect.poll(() => calls.length).toBe(1);
  restore.resolve();
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Open NeueBit" })).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
  await page.clock.fastForward(30_000);
  expect(calls.map((call) => call.path)).toEqual(["/auth/me"]);
  expect(calls[0].authorization).toBe(`Bearer ${SESSION_TOKEN}`);
  expectNoProductCode(scripts);
  await page.locator(".marketing-hero").getByRole("link", { name: "Open NeueBit" }).click();
  await expectWorkspace(page);
});

test("expired stored token leaves the public page accessible", async ({ page }) => {
  await seedSession(page);
  const { calls, scripts } = await stubApi(page, {
    "/auth/me": (route) => reply(route, { detail: "Token expired" }, 401),
  });
  await page.goto("/");
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  expect(calls.map((call) => call.path)).toEqual(["/auth/me"]);
  expectNoProductCode(scripts);
});

for (const path of ["/auth", "/auth?mode=login", "/auth?mode=unknown"]) {
  test(`direct ${path} defaults to login without product code`, async ({ page }) => {
    const { calls, scripts } = await stubApi(page);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeFocused();
    await expect(page).toHaveTitle("NeueBit — Sign in");
    await expect(page.getByLabel("Confirm password", { exact: true })).toHaveCount(0);
    expect(calls).toEqual([]);
    expectNoProductCode(scripts);
  });
}

test("direct private access redirects to login using replace", async ({ page }) => {
  const { calls, scripts } = await stubApi(page);
  await page.goto("/");
  // A normal link-equivalent browser navigation adds /app to history.
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
});

test("authenticated auth access opens the app after verification", async ({ page }) => {
  await seedSession(page);
  const { scripts } = await stubApi(page);
  await page.goto("/auth?mode=register");
  await expectWorkspace(page);
  await expect(page).toHaveTitle("NeueBit — Workspace");
  expect(scripts.some((url) => /\/LandingPage-/.test(url))).toBe(false);
});

test("direct app access waits for session verification before mounting product", async ({ page }) => {
  const restore = deferred();
  await seedSession(page);
  const { calls, scripts } = await stubApi(page, { "/auth/me": async (route) => {
    await restore.promise;
    await reply(route, USER);
  } });
  await page.goto("/app");
  await expect(page.getByText("Verifying your session…")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Primary sidebar" })).toHaveCount(0);
  expect(calls.map((call) => call.path)).toEqual(["/auth/me"]);
  expectNoProductCode(scripts);
  restore.resolve();
  await expectWorkspace(page);
});

test("verification failure retains the token and retry recovers", async ({ page }) => {
  await seedSession(page);
  let attempts = 0;
  const { calls, scripts } = await stubApi(page, { "/auth/me": (route) => {
    attempts++;
    return attempts === 1 ? reply(route, { detail: "Temporarily unavailable" }, 503) : reply(route, USER);
  } });
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: "Connection unavailable" })).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(SESSION_TOKEN);
  expect(calls.map((call) => call.path)).toEqual(["/auth/me"]);
  expectNoProductCode(scripts);
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expectWorkspace(page);
  expect(attempts).toBe(2);
});

test("public entry remains available when session verification fails", async ({ page }) => {
  await seedSession(page);
  const { scripts } = await stubApi(page, {
    "/auth/me": (route) => reply(route, { detail: "Temporarily unavailable" }, 503),
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your knowledge, in context." })).toBeVisible();
  await page.locator(".marketing-hero").getByRole("link", { name: "Continue to NeueBit" }).click();
  await expect(page.getByRole("heading", { name: "Connection unavailable" })).toBeVisible();
  await page.getByRole("link", { name: "Back to NeueBit" }).click();
  await expect(page).toHaveURL(/\/$/);
  expectNoProductCode(scripts);
});

test("log out from verification failure removes the token and opens login", async ({ page }) => {
  await seedSession(page);
  await stubApi(page, { "/auth/me": (route) => reply(route, { detail: "Unavailable" }, 503) });
  await page.goto("/app");
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true }).getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("expired app session is cleared and explained at login", async ({ page }) => {
  await seedSession(page);
  const { scripts } = await stubApi(page, { "/auth/me": (route) => reply(route, { detail: "Expired" }, 401) });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("alert")).toHaveText("Your session expired. Sign in again.");
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  expectNoProductCode(scripts);
});

test("sign in, refresh, public return, and logout preserve the session boundary", async ({ page }) => {
  const { calls } = await stubApi(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await fillCredentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectWorkspace(page);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(SESSION_TOKEN);
  expect(calls.slice(0, 2).map((call) => call.path)).toEqual(["/auth/login", "/auth/me"]);
  await page.reload();
  await expectWorkspace(page);
  expect(calls.filter((call) => call.path === "/auth/me")).toHaveLength(2);
  // Successful auth replaced the auth history entry, so Back returns to public.
  await page.goBack();
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Open NeueBit" })).toBeVisible();
  await page.goForward();
  await expectWorkspace(page);
  await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).fill("Private unsent draft");
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true }).getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("complementary", { name: "Primary sidebar" })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  await page.goBack();
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await fillCredentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expectWorkspace(page);
  await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toHaveValue("");
});

test("create account registers, signs in, verifies, then opens the product", async ({ page }) => {
  const { calls } = await stubApi(page);
  await page.goto("/auth?mode=register");
  await page.reload();
  await expect(page).toHaveTitle("NeueBit — Create account");
  await fillCredentials(page);
  await page.getByLabel("Confirm password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expectWorkspace(page);
  expect(calls.slice(0, 3).map((call) => [call.method, call.path])).toEqual([
    ["POST", "/auth/register"], ["POST", "/auth/login"], ["GET", "/auth/me"],
  ]);
});

test("registration success with failed auto-login recovers to login", async ({ page }) => {
  const { calls } = await stubApi(page, {
    "/auth/login": (route) => reply(route, { detail: "Please sign in again" }, 503),
  });
  await page.goto("/auth?mode=register");
  await fillCredentials(page);
  await page.getByLabel("Confirm password", { exact: true }).fill("test-password-123");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("status")).toHaveText("Account created. Sign in to continue.");
  await expect(page.getByRole("alert")).toHaveText("Please sign in again");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(USER.email);
  expect(calls.map((call) => call.path)).toEqual(["/auth/register", "/auth/login"]);
});

test("mismatched registration passwords do not submit", async ({ page }) => {
  const { calls } = await stubApi(page);
  await page.goto("/auth?mode=register");
  await fillCredentials(page);
  await page.getByLabel("Confirm password", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
  expect(calls).toEqual([]);
});

test("URL-driven form toggles clear secrets and preserve normal Back/Forward", async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in" }).click();
  await fillCredentials(page);
  await page.getByRole("button", { name: "Show password", exact: true }).click();
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/auth\?mode=register$/);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(USER.email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeFocused();
});

test("rejected credentials remain on login without exposing the product", async ({ page }) => {
  const { calls, scripts } = await stubApi(page, {
    "/auth/login": (route) => reply(route, { detail: "Invalid credentials" }, 401),
  });
  await page.goto("/auth");
  await fillCredentials(page);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid credentials");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  expect(calls.map((call) => call.path)).toEqual(["/auth/login"]);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
  expectNoProductCode(scripts);
});

for (const pendingPath of ["/auth/login", "/auth/register", "/auth/me"]) {
  test(`leaving auth during ${pendingPath} cannot sign in later`, async ({ page }) => {
    const pending = deferred();
    const { calls, scripts } = await stubApi(page, { [pendingPath]: async (route) => {
      await pending.promise;
      await reply(route, pendingPath === "/auth/login"
        ? { access_token: SESSION_TOKEN, token_type: "bearer" } : USER);
    } });
    await page.goto(pendingPath === "/auth/register" ? "/auth?mode=register" : "/auth?mode=login");
    await fillCredentials(page);
    if (pendingPath === "/auth/register") await page.getByLabel("Confirm password", { exact: true }).fill("test-password-123");
    await page.getByRole("button", { name: pendingPath === "/auth/register" ? "Create account" : "Sign in", exact: true }).click();
    await expect.poll(() => calls.some((call) => call.path === pendingPath)).toBe(true);
    await page.getByRole("link", { name: "Back to NeueBit" }).click();
    await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toBeVisible();
    const completed = pendingPath === "/auth/me" ? null
      : page.waitForResponse((response) => response.url().endsWith(pendingPath));
    pending.resolve();
    // /me is actually aborted; login/register lack API cancellation but must be ignored.
    if (pendingPath !== "/auth/me") await completed;
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    expect(calls.map((call) => call.path)).toEqual(pendingPath === "/auth/me" ? ["/auth/login", "/auth/me"] : [pendingPath]);
    expectNoProductCode(scripts);
  });
}

test("runtime unauthorized response removes private UI and returns to login", async ({ page }) => {
  await seedSession(page);
  await stubApi(page, { "/documents": (route) => reply(route, { detail: "Expired" }, 401) });
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth\?mode=login$/);
  await expect(page.getByRole("alert")).toHaveText("Your session expired. Sign in again.");
  await expect(page.getByRole("complementary", { name: "Primary sidebar" })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
});

test("unknown paths show an accessible client 404 and return home", async ({ page }) => {
  const { calls, scripts } = await stubApi(page);
  await page.goto("/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeFocused();
  await expect(page).toHaveTitle("NeueBit — Page not found");
  await page.getByRole("link", { name: "Return home" }).click();
  await expect(page.locator(".marketing-hero").getByRole("link", { name: "Get started" })).toBeVisible();
  expect(calls).toEqual([]);
  expectNoProductCode(scripts);
});

test("trailing slashes normalize while preserving auth mode and hash", async ({ page }) => {
  await stubApi(page);
  await page.goto("/auth/?mode=register#form");
  await expect(page).toHaveURL(/\/auth\?mode=register#form$/);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
});

test("a failed route chunk has a recoverable reload action", async ({ page }) => {
  await stubApi(page);
  let failed = false;
  await page.route("**/assets/AuthGate-*.js", async (route) => {
    if (failed) return route.continue();
    failed = true;
    await route.abort("failed");
  });
  await page.goto("/auth");
  await expect(page.getByRole("heading", { name: "Unable to open NeueBit" })).toBeVisible();
  await page.getByRole("button", { name: "Reload page" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
