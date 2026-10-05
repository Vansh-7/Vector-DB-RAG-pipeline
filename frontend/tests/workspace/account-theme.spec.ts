import { test, expect, seedSession, SESSION_TOKEN, TOKEN_KEY, USER, reply } from "../entry/fixtures";
import { appearance, knowledgeApi } from "../theme/fixtures";
import { AVATAR_COUNT, getAvatarIndex } from "../../src/lib/avatar";

const channels = (color: string) => {
  const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
  return color.startsWith("color(srgb") ? values.map((value) => value * 255) : values;
};
const luminance = (color: string) => channels(color).map((channel) => {
  const value = channel / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
}).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
const contrast = (first: string, second: string) => {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

for (const theme of ["light", "dark"] as const) {
  for (const width of [1280, 1440]) {
    test(`${theme} account popover, neutral dialog and red logout confirmation at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await appearance(page, theme); await seedSession(page); await knowledgeApi(page); await page.goto("/app");
      const trigger = page.getByRole("button", { name: "Account menu", exact: true });
      await trigger.focus(); await page.keyboard.press("ArrowDown");
      const menu = page.getByRole("menu", { name: "Account", exact: true });
      const row = menu.getByRole("menuitem", { name: /Appearance/ });
      await expect(row).toBeFocused();
      await expect(menu).toHaveCSS("box-shadow", "none");
      await expect(menu).toHaveCSS("border-radius", "8px");
      await expect(menu).toHaveCSS("border-top-width", "1px");
      await expect(menu).toHaveCSS("width", "236px");
      await expect(menu).toHaveCSS("padding", "6px");
      const portrait = menu.locator(".account-menu-info .user-avatar");
      await expect(portrait).toHaveAttribute("data-avatar-index", String(getAvatarIndex(USER.id)));
      await expect(portrait).toHaveCSS("width", "34px");
      await expect(portrait.locator("svg")).toHaveCount(1);
      await expect(row).toHaveCSS("height", "36px");
      const surface = await menu.evaluate((element) => {
        const style = getComputedStyle(element);
        const label = getComputedStyle(element.querySelector(".account-menu-caption")!);
        return { background: style.backgroundColor, caption: label.color };
      });
      expect(surface.background).toBe(theme === "light" ? "rgb(255, 255, 255)" : "rgb(32, 32, 32)");
      const sidebarSurface = await page.getByRole("complementary", { name: "Primary sidebar" }).evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(luminance(surface.background)).toBeGreaterThan(luminance(sidebarSurface));
      expect(contrast(surface.background, surface.caption)).toBeGreaterThanOrEqual(4.5);
      const bounds = (await menu.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0); expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0); expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
      await page.keyboard.press("ArrowRight");
      const appearanceMenu = page.getByRole("menu", { name: "Appearance", exact: true });
      await expect(appearanceMenu).toBeVisible();
      const appearanceBounds = (await appearanceMenu.boundingBox())!;
      expect(appearanceBounds.width).toBe(bounds.width); expect(appearanceBounds.height).toBe(bounds.height);
      await expect(appearanceMenu.locator(".account-menu-caption")).toHaveCSS("font-size", "12px");
      for (const label of ["Light", "Dark"]) {
        const option = appearanceMenu.getByRole("menuitemradio", { name: label, exact: true });
        await expect(option).toHaveCSS("height", "36px");
        await expect(option).toHaveAttribute("aria-checked", String(theme === label.toLowerCase()));
        await expect(option).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      }
      const checked = appearanceMenu.locator(".account-menu-check");
      await expect(checked).toHaveCount(1);
      const checkAlignment = await checked.evaluate((element) => {
        const icon = element.getBoundingClientRect(); const row = element.parentElement!.getBoundingClientRect();
        return row.right - icon.right;
      });
      expect(checkAlignment).toBe(8);
      await page.keyboard.press("ArrowLeft"); await expect(row).toBeFocused();
      await row.hover(); await expect(row).toHaveCSS("box-shadow", "none");
      await expect(row).toHaveCSS("border-top-width", "0px");
      await page.keyboard.press("ArrowDown");
      const logout = menu.getByRole("menuitem", { name: "Log out", exact: true });
      await expect(logout).toBeFocused(); await logout.hover();
      await expect(logout).toHaveCSS("outline-style", "solid");
      const dangerRow = await logout.evaluate((element) => {
        const style = getComputedStyle(element); return { color: style.color, background: style.backgroundColor };
      });
      const dangerForeground = channels(dangerRow.color);
      expect(dangerForeground[0]).toBeGreaterThan(Math.max(dangerForeground[1], dangerForeground[2]) * 1.5);
      const alpha = Number(dangerRow.background.match(/[\d.]+/g)![3]);
      expect(alpha).toBe(.08);
      const tinted = channels(dangerRow.background).map((value, index) => value * alpha + channels(surface.background)[index] * (1 - alpha));
      expect(contrast(dangerRow.color, `rgb(${tinted.join(", ")})`)).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press("Space");
      const dialog = page.getByRole("dialog", { name: "Log out of NeueBit?", exact: true });
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      await expect(dialog).toHaveCSS("max-width", "440px");
      await expect(dialog).toHaveCSS("box-shadow", "none");
      await expect(dialog).toHaveCSS("border-radius", "10px");
      const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
      await expect(cancel).toBeFocused();
      const confirmation = dialog.getByRole("button", { name: "Log out", exact: true });
      const action = await confirmation.evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, foreground: style.color };
      });
      const red = channels(action.background);
      expect(red[0]).toBeGreaterThan(Math.max(red[1], red[2]) * 2);
      expect(channels(action.foreground)).toEqual([255, 255, 255]);
      expect(contrast(action.background, action.foreground)).toBeGreaterThanOrEqual(4.5);
      const dialogSurface = await dialog.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(Math.max(...channels(dialogSurface)) - Math.min(...channels(dialogSurface))).toBeLessThanOrEqual(1);
      await confirmation.hover();
      const hover = await confirmation.evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(luminance(hover)).toBeLessThan(luminance(action.background));
      expect(contrast(hover, action.foreground)).toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: testInfo.outputPath(`logout-${theme}-${width}.png`) });
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
      expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBe(SESSION_TOKEN);
      await trigger.click(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
      await expect(cancel).toBeFocused(); await page.keyboard.press("Shift+Tab");
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      await trigger.click(); await page.keyboard.press("End"); await page.keyboard.press("Enter");
      await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
      await expect(trigger).toBeFocused();
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} original avatars are deterministic, decorative and consistent in the sidebar and menu`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    let userId = USER.id;
    await page.route("**/api/v1/auth/me", (route) => reply(route, { ...USER, id: userId }));
    const portraits: string[] = [];
    let portraitPalette = { paper: "", ink: "" };
    for (let index = 0; index < AVATAR_COUNT; index++) {
      userId = Array.from({ length: 64 }, (_, value) => value + 1).find((id) => getAvatarIndex(id) === index)!;
      await page.goto("/app");
      const trigger = page.getByRole("button", { name: "Account menu", exact: true });
      const avatar = trigger.locator(".user-avatar");
      await expect(avatar).toHaveAttribute("data-avatar-index", String(index));
      await expect(avatar).toHaveAttribute("aria-hidden", "true");
      await expect(avatar).toHaveCSS("width", "28px");
      await expect(avatar).toHaveCSS("height", "28px");
      await expect(avatar).toHaveCSS("box-shadow", "none");
      await expect(avatar.locator("svg")).toHaveAttribute("aria-hidden", "true");
      portraitPalette = await avatar.evaluate((element) => {
        const style = getComputedStyle(element);
        return { paper: style.backgroundColor, ink: style.color };
      });
      // Hair and facial details stay darker than the face in both themes.
      expect(luminance(portraitPalette.ink)).toBeLessThan(luminance(portraitPalette.paper));
      expect(contrast(portraitPalette.ink, portraitPalette.paper)).toBeGreaterThanOrEqual(7);
      if (theme === "dark") {
        for (const color of Object.values(portraitPalette)) {
          const values = channels(color);
          expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
        }
        // A softened gray field keeps the tiny portrait legible without a pure-white tile.
        expect(luminance(portraitPalette.paper)).toBeLessThan(luminance("rgb(242, 242, 242)"));
      }
      const svg = await avatar.locator("svg").evaluate((element) => element.outerHTML);
      portraits.push(svg);
      await trigger.click();
      const menuAvatar = page.getByRole("menu", { name: "Account", exact: true }).locator(".user-avatar");
      await expect(menuAvatar).toHaveAttribute("data-avatar-index", String(index));
      await expect(menuAvatar).toHaveCSS("background-color", portraitPalette.paper);
      await expect(menuAvatar).toHaveCSS("color", portraitPalette.ink);
      expect(await menuAvatar.locator("svg").evaluate((element) => element.outerHTML)).toBe(svg);
      await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
      await page.reload();
      await expect(avatar).toHaveAttribute("data-avatar-index", String(index));
    }
    expect(new Set(portraits).size).toBe(AVATAR_COUNT);
    await page.getByRole("button", { name: "Collapse navigation", exact: true }).click();
    const trigger = page.getByRole("button", { name: "Account menu", exact: true });
    await trigger.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Account", exact: true })).toBeVisible();
    await expect(page.getByRole("menu", { name: "Account", exact: true })).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`avatars-collapsed-${theme}.png`) });
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
    const storage = await page.evaluate(() => JSON.parse(localStorage.getItem("vectordb-session-storage")!).state);
    expect(Object.keys(storage).sort()).toEqual(["isNavigationCollapsed", "sidebarWidth", "terminalHeight"]);
    await page.getByRole("button", { name: "Expand navigation", exact: true }).click();
    await expect(page.getByRole("complementary", { name: "Primary sidebar" })).toHaveCSS("width", "256px");
    await trigger.click();
    await expect(page.getByRole("menu", { name: "Account", exact: true })).toHaveCSS("opacity", "1");
    await page.screenshot({ path: testInfo.outputPath(`avatars-expanded-${theme}.png`) });
    // Review the actual rendered palette at portrait and account-control sizes.
    await page.evaluate(({ portraits, palette }) => {
      const canvas = getComputedStyle(document.querySelector(".authenticated-app")!).backgroundColor;
      document.body.innerHTML = `<main style="padding:48px;width:max-content;margin:auto;display:grid;grid-template-columns:repeat(4,160px);gap:24px;justify-content:center;color:${palette.ink};--avatar-paper:${palette.paper}">${portraits.map((portrait) => `<div style="display:grid;gap:12px"><div style="width:160px;height:160px;background:${palette.paper};border-radius:24px;overflow:hidden">${portrait.replace("<svg ", '<svg style="width:100%;height:100%" ')}</div><div style="display:flex;align-items:center;gap:12px">${[28, 34].map((size) => `<div style="width:${size}px;height:${size}px;background:${palette.paper};border-radius:7px;overflow:hidden">${portrait.replace("<svg ", '<svg style="width:100%;height:100%" ')}</div>`).join("")}</div></div>`).join("")}</main>`;
      document.body.style.background = canvas;
    }, { portraits, palette: portraitPalette });
    await page.locator("main").screenshot({ path: testInfo.outputPath(`portrait-family-${theme}.png`) });
  });

  test(`${theme} missing user ID falls back to an initial without changing account semantics`, async ({ page }) => {
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    await page.route("**/api/v1/auth/me", (route) => reply(route, { ...USER, id: undefined }));
    await page.goto("/app");
    const trigger = page.getByRole("button", { name: "Account menu", exact: true });
    await expect(trigger.locator(".user-avatar")).toHaveAttribute("data-avatar-index", "initial");
    await expect(trigger.locator(".user-avatar")).toHaveText("R");
    await expect(trigger.locator("svg[viewBox='0 0 80 80']")).toHaveCount(0);
    await trigger.click();
    const menu = page.getByRole("menu", { name: "Account", exact: true });
    await expect(menu.locator(".user-avatar")).toHaveText("R");
    await expect(menu.getByText(USER.email, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  });

  test(`${theme} operator account header keeps long email and indicator inside the popover`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await appearance(page, theme); await seedSession(page); await knowledgeApi(page);
    const email = "operator.with.a.long.account.address@example.com";
    await page.route("**/api/v1/auth/me", (route) => reply(route, { ...USER, email, is_operator: true }));
    await page.goto("/app");
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    const menu = page.getByRole("menu", { name: "Account", exact: true });
    await expect(menu.getByText("Operator", { exact: true })).toBeVisible();
    await expect(menu.locator(".account-menu-email")).toHaveAttribute("title", email);
    expect(await menu.locator(".account-menu-email").evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    expect(await menu.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(menu.getByRole("menuitem")).toHaveCount(2);
  });
}

for (const width of [1280, 1440]) {
  test(`dark workspaces inherit neutral surfaces with usable text contrast at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await appearance(page, "dark"); await seedSession(page); await knowledgeApi(page); await page.goto("/app");
    const palette = await page.locator(".authenticated-app").evaluate((element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(["--canvas", "--surface", "--surface-elevated", "--surface-hover", "--pane-surface", "--composer-surface", "--composer-focus-surface", "--text-primary", "--text-secondary", "--text-tertiary", "--text-placeholder"].map((token) => [token, style.getPropertyValue(token).trim()]));
    });
    const rgb = (value: string) => value.startsWith("#") ? `rgb(${[1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16)).join(", ")})` : value;
    for (const color of Object.values(palette)) {
      const values = channels(rgb(color));
      expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
    }
    expect(luminance(rgb(palette["--canvas"]))).toBeLessThan(luminance(rgb(palette["--surface"])));
    expect(luminance(rgb(palette["--surface"])) ).toBeLessThan(luminance(rgb(palette["--surface-elevated"])));
    expect(luminance(rgb(palette["--surface-elevated"])) ).toBeLessThan(luminance(rgb(palette["--surface-hover"])));
    for (const text of ["--text-primary", "--text-secondary", "--text-tertiary", "--text-placeholder"]) {
      expect(contrast(rgb(palette[text]), rgb(palette["--surface-hover"]))).toBeGreaterThanOrEqual(4.5);
    }
    const sidebar = page.getByRole("complementary", { name: "Primary sidebar" });
    for (const view of ["Documents", "Search", "Vector Lab", "Chat"]) {
      await sidebar.getByRole("button", { name: view, exact: true }).click();
      if (view === "Documents") {
        const action = await page.getByRole("button", { name: "Add document", exact: true }).evaluate((element) => {
          const style = getComputedStyle(element);
          return { background: style.backgroundColor, foreground: style.color };
        });
        expect(contrast(action.background, action.foreground)).toBeGreaterThanOrEqual(4.5);
      }
      const canvas = await page.locator(".authenticated-app").evaluate((element) => getComputedStyle(element).backgroundColor);
      expect(canvas).toBe("rgb(20, 20, 20)");
    }
    await sidebar.getByRole("button", { name: "Collapse navigation" }).click();
    await expect(sidebar).toHaveCSS("width", "56px");
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await expect(page.getByRole("menu", { name: "Account", exact: true })).toHaveCSS("background-color", "rgb(32, 32, 32)");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
