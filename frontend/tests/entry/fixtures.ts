import { test as base, expect, type Page, type Route } from "@playwright/test";

export const TOKEN_KEY = "kernspace-access-token";
export const SESSION_TOKEN = "entry-test-token";
export const USER = {
  id: 1,
  email: "reader@example.com",
  is_active: true,
  is_operator: false,
  created_at: "2026-01-01T00:00:00Z",
};

export const test = base.extend<{ runtimeErrors: string[] }>({
  runtimeErrors: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await use(errors);
    expect(errors, "No uncaught browser exceptions").toEqual([]);
  }, { auto: true }],
});
export { expect };

export async function chooseAppTheme(page: Page, theme: "light" | "dark") {
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: /Appearance/ }).click();
  await page.getByRole("menuitemradio", { name: theme === "light" ? "Light" : "Dark", exact: true }).focus();
  await page.keyboard.press("Space");
}

export async function signOutFromApp(page: Page) {
  await page.getByRole("button", { name: "Account menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Log out", exact: true }).click();
  await page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true }).getByRole("button", { name: "Log out", exact: true }).click();
}

export function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

export async function reply(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    json: data,
    headers: { "access-control-allow-origin": "*" },
  });
}

export async function seedSession(page: Page, token = SESSION_TOKEN) {
  await page.addInitScript(({ key, value }) => {
    // Seed only once so reload cannot resurrect a signed-out or expired token.
    if (!sessionStorage.getItem("entry-fixture-seeded")) {
      localStorage.setItem(key, value);
      sessionStorage.setItem("entry-fixture-seeded", "true");
    }
  }, { key: TOKEN_KEY, value: token });
}

export async function stubApi(page: Page, overrides: Record<string, (route: Route) => Promise<void>> = {}) {
  const calls: { path: string; method: string; authorization: string | undefined }[] = [];
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(request.url());
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "authorization,content-type",
        "access-control-allow-methods": "GET,POST,DELETE,PATCH",
      } });
      return;
    }
    const path = new URL(request.url()).pathname.replace("/api/v1", "");
    calls.push({ path, method: request.method(), authorization: request.headers()["authorization"] });
    if (overrides[path]) return overrides[path](route);
    switch (path) {
      case "/auth/me": return reply(route, USER);
      case "/auth/register": return reply(route, USER, 201);
      case "/auth/login": return reply(route, { access_token: SESSION_TOKEN, token_type: "bearer" });
      case "/status": return reply(route, { engine: "hnsw", metric: "cosine", total_docs: 0 });
      case "/documents":
      case "/conversations": return reply(route, []);
      case "/vectors/sample": return reply(route, { vectors: [], count: 0 });
      default: throw new Error(`Unexpected API call: ${request.method()} ${path}`);
    }
  });
  return { calls, scripts };
}

export async function fillCredentials(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill(USER.email);
  await page.getByLabel("Password", { exact: true }).fill("test-password-123");
}

export async function expectWorkspace(page: Page) {
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("complementary", { name: "Primary sidebar" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Chat workspace" })).toBeVisible();
}

export function expectNoProductCode(scripts: string[]) {
  expect(scripts.filter((url) => /\/AppShell-|\/d3-|\/VectorLab-/.test(url))).toEqual([]);
}
