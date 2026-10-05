import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test, expect, stubApi } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";
import { heroFilmChapters } from "../../src/components/marketing/heroFilmTimings";

for (const theme of ["light", "dark"] as const) for (const [width, height] of [
  [1920, 1080], [1440, 900], [1280, 800], [1024, 900], [430, 900], [390, 900],
]) {
  test(`${theme} ${width}px film retains its whole frame and quiet perimeter figures`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await appearance(page, theme, theme);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls, scripts } = await stubApi(page);
    const movies: string[] = [];
    page.on("request", request => { if (request.url().endsWith(".mp4")) movies.push(request.url()); });
    await page.goto("/");
    const frame = page.locator(".film-screen"), figures = page.locator(".film-illustrations");
    await expect(frame).toHaveCSS("border-radius", "12px");
    expect(await frame.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe("none");
    await expect(figures).toHaveAttribute("aria-hidden", "true");
    await expect(figures).toHaveCSS("pointer-events", "none");
    await expect(figures.locator("img")).toHaveCount(2);
    await expect(figures.locator("svg")).toHaveCount(0);
    await expect(figures.locator("img").nth(0)).toHaveAttribute("src", "/illustrations/product-film/reader-peek.png");
    await expect(figures.locator("img").nth(1)).toHaveAttribute("src", "/illustrations/product-film/observer-magnifier.png");
    for (const img of await figures.locator("img").all()) await expect(img).toHaveAttribute("alt", "");
    if (theme === "light" && width >= 1200) {
      await expect(page.locator(".film-observer")).toBeVisible();
      await expect(page.locator(".film-reader")).toBeVisible();
      const screen = (await frame.boundingBox())!, observer = (await page.locator(".film-observer").boundingBox())!;
      const reader = (await page.locator(".film-reader").boundingBox())!;
      expect(observer.y + observer.height).toBeLessThanOrEqual(screen.y + 6);
      expect(observer.width / screen.width).toBeGreaterThanOrEqual(.11);
      expect(observer.width / screen.width).toBeLessThanOrEqual(.15);
      expect(reader.x).toBeGreaterThanOrEqual(0);
      expect(reader.x).toBeLessThan(screen.x);
      expect(reader.x + reader.width).toBeGreaterThan(screen.x);
      expect(reader.y).toBeGreaterThan(screen.y);
      expect(reader.y + reader.height).toBeLessThan(screen.y + screen.height);
      expect(observer.width / observer.height).toBeCloseTo(1128 / 744, 2);
      const readerAspect = await page.locator(".film-reader img").evaluate(image => image.naturalWidth / image.naturalHeight);
      expect(reader.width / reader.height).toBeCloseTo(readerAspect, 2);
      await expect(frame).toHaveCSS("z-index", "1");
      await expect(page.locator(".film-reader")).toHaveCSS("z-index", "0");
      await expect(page.locator(".film-observer")).toHaveCSS("z-index", "2");
      expect(await page.locator(".film-observer").evaluate(element => getComputedStyle(element).transform)).toBe("none");
    } else await expect(figures).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".film-video")).toHaveAttribute("poster", `/product/film/neuebit-${width < 768 ? "mobile" : "desktop"}-${theme}.webp`);
    expect(movies).toEqual([]); expect(calls).toEqual([]);
    expect(scripts.filter(url => /AppShell-|d3-|VectorLab-/.test(url))).toEqual([]);
    const directory = fileURLToPath(new URL("../../scripts/test-results/film-artwork-review/", import.meta.url));
    await mkdir(directory, { recursive: true });
    const variant = `${width}-${theme}`;
    await page.locator(".marketing-hero").screenshot({ path: `${directory}/${variant}-poster.png` });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await frame.scrollIntoViewIfNeeded();
    // Leave room above the frame for the observer below the sticky header.
    // Full-page review clips should show the intended composition unobstructed.
    await frame.evaluate(element => window.scrollTo({
      top: Math.max(0, element.getBoundingClientRect().top + scrollY - 200), behavior: "instant",
    }));
    const video = page.locator(".film-video");
    await expect(page.locator(".product-film")).toHaveAttribute("data-presentation", "playing");
    if (theme === "light" && width >= 1200) await expect(page.locator(".film-observer")).toHaveCSS("opacity", "1");
    for (const [name, time, scene] of [["search", 6, "search"]] as const) {
      await video.evaluate(async (element, seconds) => {
        element.pause();
        // seeked can precede compositor presentation. Wait for the decoded
        // frame to be painted so review PNGs cannot retain the previous scene.
        await new Promise<void>(done => {
          element.requestVideoFrameCallback(() => done()); element.currentTime = seconds;
        });
      }, time);
      await expect(page.locator(".product-film")).toHaveAttribute("data-scene", scene);
      const box = (await frame.boundingBox())!;
      const scroll = await page.evaluate(() => scrollY);
      await page.screenshot({ path: `${directory}/${variant}-${name}.png`, fullPage: true,
        clip: { x: 0, y: box.y + scroll - (width >= 1200 ? 130 : 16), width,
          height: box.height + (width >= 1200 ? 180 : 32) } });
      if (theme === "light" && width >= 1200) {
        const occluded = await page.locator(".film-reader").evaluate(element => {
          const reader = element.getBoundingClientRect();
          const frame = document.querySelector(".film-screen")!.getBoundingClientRect();
          return !!document.elementFromPoint(frame.x + 8, reader.y + reader.height / 2)?.closest(".film-screen");
        });
        expect(occluded, "Product frame is painted in front of the reader").toBe(true);
      }
    }
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
  await expect(page.locator(".film-illustrations")).toBeHidden();
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

test("supplied figures finish their entrance and remain still across source and vector scenes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await stubApi(page); await page.goto("/");
  const figures = page.locator(".film-artwork");
  await expect(page.locator('[data-hero-part="preview"]')).toHaveCSS("transform", "none");
  for (const figure of await figures.all()) {
    await expect(figure).toHaveCSS("opacity", "1");
    await expect(figure).toHaveCSS("transform", "none");
    await expect(figure.locator("img")).toHaveCSS("filter", "none");
    await expect(figure.locator("img")).toHaveCSS("box-shadow", "none");
  }
  const boxes = await Promise.all((await figures.all()).map(figure => figure.boundingBox()));
  for (const [time, scene] of [[10.5, "sources"], [13, "vectors"], [15.5, "documents"]] as const) {
    await page.locator(".film-video").evaluate(async (video, seconds) => {
      video.pause();
      await new Promise<void>(done => {
        video.requestVideoFrameCallback(() => done()); video.currentTime = seconds;
      });
    }, time);
    await expect(page.locator(".product-film")).toHaveAttribute("data-scene", scene);
    expect(await Promise.all((await figures.all()).map(figure => figure.boundingBox()))).toEqual(boxes);
    for (const figure of await figures.all()) await expect(figure).toHaveCSS("transform", "none");
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
