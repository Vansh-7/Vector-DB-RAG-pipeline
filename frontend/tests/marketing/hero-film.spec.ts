import { readFile } from "node:fs/promises";
import { test, expect, stubApi } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";
import { heroFilmChapters } from "../../src/components/marketing/heroFilmTimings";

for (const theme of ["light", "dark"] as const) for (const [width, height] of [
  [1920, 1080], [1440, 900], [1280, 800], [1024, 900], [768, 900], [390, 900], [375, 900], [320, 900],
]) {
  test(`${theme} ${width}px film retains its whole frame without perimeter figures`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls, scripts } = await stubApi(page);
    const movies: string[] = [];
    page.on("request", request => { if (request.url().endsWith(".mp4")) movies.push(request.url()); });
    await page.goto("/");
    const frame = page.locator(".film-screen"), video = page.locator(".film-video");
    const variant = `${width < 768 ? "mobile" : "desktop"}-${theme}`;
    await expect(page.locator(".film-illustrations, .film-artwork, .film-reader, .film-observer")).toHaveCount(0);
    await expect(page.locator('img[src*="/illustrations/product-film/"]')).toHaveCount(0);
    await expect(frame).toHaveCSS("border-radius", "12px");
    await expect(frame).toHaveCSS("border-top-width", "1px");
    await expect(frame).toHaveCSS("border-top-style", "solid");
    await expect(frame).toHaveCSS("aspect-ratio", width < 768 ? "390 / 722" : "1280 / 722");
    const shadow = await frame.evaluate(element => getComputedStyle(element).boxShadow);
    expect(shadow).not.toBe("none");
    const before = (await frame.boundingBox())!;
    const poster = `/product/film/neuebit-${variant}.webp`;
    await expect(video).toHaveAttribute("poster", poster);
    expect(await page.evaluate(async src => {
      const image = new Image(); image.src = src; await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    }, poster)).toEqual({width: width < 768 ? 390 : 1280, height: 722});
    await expect(video).not.toHaveAttribute("src");
    expect(movies).toEqual([]); expect(calls).toEqual([]);
    expect(scripts.filter(url => /AppShell-|d3-|VectorLab-/.test(url))).toEqual([]);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await frame.scrollIntoViewIfNeeded();
    await expect(page.locator(".product-film")).toHaveAttribute("data-presentation", "playing");
    await expect(video).toHaveAttribute("src", `/product/film/neuebit-${variant}.mp4`);
    await video.evaluate(async element => {
      element.pause();
      await new Promise<void>(done => {
        element.requestVideoFrameCallback(() => done()); element.currentTime = 6;
      });
    });
    await expect(page.locator(".product-film")).toHaveAttribute("data-scene", "search");
    const after = (await frame.boundingBox())!;
    expect(after.width).toBeCloseTo(before.width, 1);
    expect(after.height).toBeCloseTo(before.height, 1);
    expect(await frame.evaluate(element => getComputedStyle(element).boxShadow)).toBe(shadow);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("a failed movie retains the correctly themed static poster", async ({ page }) => {
  await appearance(page, "dark", "dark");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await stubApi(page);
  await page.route("**/product/film/*.mp4", route => route.fulfill({ status: 404 }));
  await page.goto("/");
  const film = page.locator(".product-film");
  await expect(film).toHaveAttribute("data-fallback", "error");
  await expect(film).toHaveAttribute("data-presentation", "complete");
  await expect(film.getByRole("img")).toHaveAttribute("src", "/product/film/neuebit-desktop-dark.webp");
  await expect(film.getByRole("img")).toBeVisible();
  await expect(film.locator("video")).toHaveCount(0);
});

test("the film stays within a 320px viewport with enlarged text", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 1100 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await stubApi(page); await page.goto("/");
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  for (const selector of [".marketing-hero", ".hero-product", ".product-film", ".film-screen"]) {
    const box = (await page.locator(selector).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(320);
  }
  await expect(page.locator(".film-illustrations")).toHaveCount(0);
});

test("autoplay rejection falls back to a poster without a runtime exception", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Autoplay disabled", "NotAllowedError"));
  });
  await stubApi(page); await page.goto("/");
  await expect(page.locator(".product-film")).toHaveAttribute("data-fallback", "error");
  await expect(page.locator(".product-film").getByRole("img")).toBeVisible();
});

test("film frame remains stable across source, vector and loop-return scenes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await stubApi(page); await page.goto("/");
  const frame = page.locator(".film-screen");
  await expect(page.locator('[data-hero-part="preview"]')).toHaveCSS("transform", "none");
  await expect(page.locator(".product-film")).toHaveAttribute("data-presentation", "playing");
  const box = await frame.boundingBox();
  for (const [time, scene] of [[10.5, "sources"], [13, "vectors"], [15.5, "documents"]] as const) {
    await page.locator(".film-video").evaluate(async (video, seconds) => {
      video.pause();
      await new Promise<void>(done => {
        video.requestVideoFrameCallback(() => done()); video.currentTime = seconds;
      });
    }, time);
    await expect(page.locator(".product-film")).toHaveAttribute("data-scene", scene);
    expect(await frame.boundingBox()).toEqual(box);
    await expect(page.locator(".film-artwork")).toHaveCount(0);
  }
});

test("encoded variants agree with generated chapters and verified capture provenance", async ({ page }) => {
  const manifest = JSON.parse(await readFile(new URL("../../public/product/film/capture-manifest.json", import.meta.url), "utf8"));
  expect(manifest.sourceFingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(manifest.assets).toHaveLength(4);
  for (const asset of manifest.assets) {
    const variant = asset.file.replace("neuebit-", "").replace(".mp4", "") as keyof typeof heroFilmChapters;
    expect(asset.chapters).toEqual(heroFilmChapters[variant]);
    expect(asset.durationSeconds).toBe(16);
    expect(asset.poster.height).toBe(asset.height);
    expect(asset.validation.posterMatchesFirstFrame).toBe(true);
    expect(asset.capture.sidebarWidth).toBe(variant.startsWith("desktop") ? 256 : 56);
    expect(asset.capture.selectedSource).toBe("sample-16");
    expect(asset.capture.streamedChunks).toBeGreaterThan(10);
    await page.goto("/");
    const metadata = await page.evaluate(async filename => {
      const video = document.createElement("video");
      video.src = `/product/film/${filename}`;
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Encoded video unavailable"));
      });
      const result = { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
      video.removeAttribute("src"); video.load();
      return result;
    }, asset.file);
    expect(metadata).toEqual({ width: asset.width, height: asset.height, duration: asset.durationSeconds });
  }
});
