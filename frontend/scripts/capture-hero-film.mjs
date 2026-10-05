// Records the current authenticated frontend; no reconstructed product markup.
import { mkdir, readFile, readdir, writeFile, copyFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve, relative } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium, expect } from "@playwright/test";
import { createServer } from "vite";
import { filmFixtures } from "./hero-film-fixtures.mjs";
import { encodeFilm, chapters } from "./encode-hero-film.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
// Separate ignored output from Playwright's run directory, which it clears.
const destination = resolve(root, "scripts/test-results/hero-film");
const finalAssets = resolve(root, "public/product/film");
const staged = resolve(destination, "encoded");
await mkdir(staged, { recursive: true });
const vite = await createServer({ root, server: { host: "127.0.0.1", port: 4176, strictPort: false } });
await vite.listen();
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
const { appearance, knowledgeApi } = await vite.ssrLoadModule("/tests/theme/fixtures.ts");
const { seedSession, expectWorkspace, reply } = await vite.ssrLoadModule("/tests/entry/fixtures.ts");
const { demoDocuments, demoChunks, demoPrompts } = await vite.ssrLoadModule("/src/components/marketing/demo/demoContent.ts");
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", headless: true });
const assets = [];

async function cleanIntermediates(directory) {
  // Delete only known generated files in one validated capture variant. Keep
  // small checkpoint PNGs and capture metadata available for visual review.
  if (!/^(desktop|mobile)-(light|dark)$/.test(relative(destination, resolve(directory)))) {
    throw new Error(`Cleanup target is outside the capture variants: ${directory}`);
  }
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) if (entry.isFile() && /^(frame-\d{5}\.png|raw\.(mp4|mkv)|frames\.(txt|gray)|(first|last|poster|reference)\.rgb)$/.test(entry.name)) {
    await rm(resolve(directory, entry.name));
  }
}

async function fingerprint() {
  const hash = createHash("sha256");
  async function visit(directory) {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name !== "heroFilmTimings.ts") hash.update(relative(root, path).replaceAll("\\", "/")).update(await readFile(path));
    }
  }
  await visit(resolve(root, "src"));
  for (const file of ["capture-hero-film.mjs", "encode-hero-film.mjs", "hero-film-fixtures.mjs"]) hash.update(file).update(await readFile(resolve(root, "scripts", file)));
  return hash.digest("hex");
}

try {
  const sourceFingerprint = await fingerprint();
  for (const theme of ["light", "dark"]) for (const format of ["desktop", "mobile"]) {
    const variant = `${format}-${theme}`, width = format === "desktop" ? 1280 : 390, height = 722;
    const directory = resolve(destination, variant);
    await mkdir(directory, { recursive: true });
    await cleanIntermediates(directory);
    // Open the same sample thread before filming. Mobile intentionally has no
    // recent-chat list, so preparation happens at desktop size, then native mobile.
    const context = await browser.newContext({ viewport: { width: 1280, height }, deviceScaleFactor: 1, locale: "en-US", reducedMotion: "no-preference" });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await appearance(page, theme, theme);
    await seedSession(page);
    const fixture = await filmFixtures(page, { knowledgeApi, reply, demoDocuments, demoChunks, demoPrompts });
    const cdp = await context.newCDPSession(page);
    let recording = false;
    const frames = [], writes = [], checkpoints = [], sceneStarts = { documents: 0 };
    try {
      await page.goto(`${origin}/app`);
      await expectWorkspace(page);
      await page.evaluate(() => document.fonts.ready);
      // A native mobile source dialog temporarily hides the surrounding shell
      // from the accessibility tree; measure the same underlying rail throughout.
      const sidebar = page.locator(".primary-sidebar");
      await sidebar.getByRole("button", { name: fixture.prompt.question, exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toBeVisible();
      if (format === "mobile") await page.setViewportSize({ width, height });
      await expect(sidebar).toHaveCSS("width", format === "desktop" ? "256px" : "56px");
      for (const label of ["New chat", "Chat", "Documents", "Search", "Vector Lab", "Account menu"]) {
        await expect(sidebar.getByRole("button", { name: label, exact: true })).toBeVisible();
      }
      if (format === "desktop") await expect(sidebar.locator(".recent-chat-row")).toHaveCount(3);
      await expect(sidebar.locator(".user-avatar svg")).toBeVisible();
      const recentChats = format === "desktop" ? await sidebar.locator(".recent-chat-row").allTextContents() : [];
      await sidebar.getByRole("button", { name: "Documents", exact: true }).click();
      await expect(page.getByRole("region", { name: "Documents workspace" }).getByText("processing", { exact: true })).toBeVisible();
      await page.mouse.move(0, 0);
      const sidebarBox = await sidebar.boundingBox();
      const shell = await page.locator(".authenticated-app").boundingBox();
      expect(shell).toEqual({ x: 0, y: 0, width, height });
      expect(await page.evaluate(() => devicePixelRatio)).toBe(1);
      await expect(page.locator(".authenticated-app")).toHaveCSS("filter", "none");
      await expect(page.locator(".film-illustrations")).toHaveCount(0);
      const appearanceCheckpoint = await sidebar.evaluate(element => ({
        theme: document.documentElement.dataset.theme,
        sidebarSurface: getComputedStyle(element).backgroundColor,
        workspaceCanvas: getComputedStyle(document.querySelector(".authenticated-app")).getPropertyValue("--canvas").trim(),
        avatarIndex: element.querySelector(".user-avatar").getAttribute("data-avatar-index"),
      }));
      expect(appearanceCheckpoint.theme).toBe(theme);
      cdp.on("Page.screencastFrame", event => {
        void cdp.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
        if (!recording) return;
        const pixels = Buffer.from(event.data, "base64");
        // Reject downsampled browser captures instead of silently scaling them
        // back up during encoding and hiding a blurred source recording.
        if (pixels.readUInt32BE(16) !== width || pixels.readUInt32BE(20) !== height) {
          errors.push("Screencast frame differs from the native capture viewport"); return;
        }
        const file = `frame-${String(frames.length).padStart(5, "0")}.png`;
        frames.push({ file, timestamp: event.metadata.timestamp, width, height });
        writes.push(writeFile(resolve(directory, file), pixels));
      });
      recording = true;
      await cdp.send("Page.startScreencast", { format: "png", maxWidth: width, maxHeight: height, everyNthFrame: 1 });
      await expect.poll(() => frames.length).toBeGreaterThan(0);
      const start = frames[0].timestamp * 1000 - performance.timeOrigin;
      fixture.state.readyAt = Date.now() + 1400;
      const at = async seconds => { await delay(Math.max(0, seconds * 1000 - (performance.now() - start))); };
      async function settledScene(scene) {
        // Edit from a painted native workspace, excluding transient route/pane
        // entry frames. The final chapter positions remain the same.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        sceneStarts[scene] = Number(((performance.now() - start) / 1000).toFixed(6));
      }
      async function checkpoint(name, scene) {
        const box = await sidebar.boundingBox();
        for (const key of ["x", "y", "width", "height"]) expect(box[key]).toBeCloseTo(sidebarBox[key], 1);
        if (format === "desktop") expect(await sidebar.locator(".recent-chat-row").allTextContents()).toEqual(recentChats);
        expect(errors).toEqual([]);
        checkpoints.push({ name, scene, capturedSeconds: Number(((performance.now() - start) / 1000).toFixed(3)), sidebarWidth: box.width });
        const screenshot = page.screenshot({ path: resolve(directory, `${name}.png`) });
        writes.push(screenshot); await screenshot;
      }
      await checkpoint("opening", "documents");
      await expect(page.getByRole("region", { name: "Documents workspace" }).getByText("ready", { exact: true })).toHaveCount(3, { timeout: 4000 });
      await checkpoint("ready", "documents");
      await at(4);
      await sidebar.getByRole("button", { name: "Search", exact: true }).click();
      const search = page.getByRole("region", { name: "Search workspace" });
      await expect(search).toBeVisible();
      await settledScene("search");
      await search.getByRole("searchbox", { name: "Search your knowledge" }).pressSequentially("retrieval", { delay: 35 });
      await search.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
      await expect(search.getByText("2 matches", { exact: true })).toBeVisible();
      await checkpoint("search-results", "search");
      await search.locator('[aria-label="Ranked search results"] button').first().click();
      const details = search.getByRole("complementary", { name: "Search result details" });
      await expect(details).toContainText("sample-16");
      // The current mobile layout places this pane below the results. Scroll
      // its real container into view rather than altering product layout.
      if (format === "mobile") await details.scrollIntoViewIfNeeded();
      await expect(details.getByText("sample-16", { exact: false })).toBeInViewport();
      await page.mouse.move(0, 0);
      await checkpoint("search-selected", "search");
      await at(7);
      await sidebar.getByRole("button", { name: "Chat", exact: true }).click();
      await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toBeVisible();
      await settledScene("chat");
      await page.getByRole("textbox", { name: "Ask a question about your knowledge" }).pressSequentially(fixture.prompt.question, { delay: 15 });
      await page.getByRole("button", { name: "Send message", exact: true }).click();
      await expect.poll(() => fixture.state.streamChunks).toBeGreaterThan(3);
      expect(fixture.state.streamComplete).toBe(false);
      await checkpoint("streaming", "chat");
      await expect(page.locator(".markdown")).toContainText(fixture.prompt.answer);
      await expect.poll(() => fixture.state.streamComplete).toBe(true);
      await at(9.5);
      await page.getByRole("button", { name: "2 sources", exact: true }).click();
      const sources = page.getByRole(format === "desktop" ? "complementary" : "dialog", { name: "Answer sources", exact: true });
      await expect(sources).toContainText("sample-16");
      await expect(sources).toContainText("RAG design.md");
      await expect(sources).toContainText("0.900");
      await expect(sources).toHaveCSS("opacity", "1");
      await expect(sources).toHaveCSS("transform", "none");
      await settledScene("sources");
      await page.mouse.move(0, 0);
      await checkpoint("sources", "sources");
      await at(11.5);
      await sources.getByRole("button", { name: "View in Vector Lab", exact: true }).click();
      const lab = page.getByRole("region", { name: "Vector Lab workspace" });
      await expect(lab).toBeVisible();
      await expect(lab.locator(".query-star")).toHaveCount(1);
      if (format === "mobile") await lab.getByRole("button", { name: "Open vector inspector", exact: true }).click();
      const inspector = page.getByRole("complementary", { name: "Vector inspector" });
      await expect(inspector).toContainText("sample-16");
      await expect(inspector).toContainText("0.90000");
      await expect(inspector).toContainText(fixture.prompt.question);
      await expect(inspector).toContainText("40.000");
      await expect(inspector).toContainText("50.000");
      await expect.poll(() => lab.locator("circle.data-point[opacity='1']").count()).toBe(1);
      expect(await lab.locator("circle.data-point[opacity='1']").evaluate(element => element.__data__.id)).toBe("sample-16");
      await expect(lab.locator(".query-edge")).toHaveCount(1);
      expect(fixture.state.writes.at(-1).body).toEqual({ text: fixture.prompt.question, k: 5 });
      await settledScene("vectors");
      await page.mouse.move(0, 0);
      await checkpoint("vectors", "vectors");
      if (format === "mobile") {
        await at(13);
        await inspector.getByRole("button", { name: "Close vector inspector", exact: true }).click();
        await expect(inspector).toBeHidden();
        await expect(lab.locator(".query-star")).toBeVisible();
        await page.mouse.move(0, 0);
        await checkpoint("vector-graph", "vectors");
      }
      await at(14.65);
      recording = false;
      await cdp.send("Page.stopScreencast");
      await Promise.all(writes);
      expect(fixture.state.documentStates).toContain("processing");
      expect(fixture.state.documentStates).toContain("ready");
      expect(checkpoints.find(item => item.name === "ready").capturedSeconds).toBeLessThan(4);
      expect(checkpoints.find(item => item.name === "sources").capturedSeconds).toBeLessThan(11.5);
      expect(checkpoints.find(item => item.name === "vectors").capturedSeconds).toBeLessThan(14.5);
      const capture = { variant, width, height, directory, frames, checkpoints, sceneStarts };
      await writeFile(resolve(directory, "capture.json"), JSON.stringify(capture, null, 2) + "\n");
      const encoded = await encodeFilm(capture, staged);
      assets.push({ ...encoded, capture: { sidebarWidth: sidebarBox.width, checkpoints, streamedChunks: fixture.state.streamChunks,
        selectedSource: "sample-16", documentId: 3, score: .9, originatingQuestion: fixture.prompt.question, queryProjection: [40, 50],
        sourcePreservedWithEmptyProjectionResults: true, deviceScaleFactor: 1, appearance: appearanceCheckpoint, recentChats } });
      await cleanIntermediates(directory);
      console.log(`Validated ${variant}: ${encoded.durationSeconds}s, ${width}x${height}, ${frames.length} actual UI frames`);
    } catch (error) {
      await page.screenshot({ path: resolve(directory, "failure.png") }).catch(() => {});
      await writeFile(resolve(directory, "failure.json"), JSON.stringify({ message: error.message, writes: fixture.state.writes, errors }, null, 2));
      throw error;
    } finally {
      recording = false;
      await cdp.send("Page.stopScreencast").catch(() => {});
      await context.close();
      await fixture.close();
    }
  }
  if (await fingerprint() !== sourceFingerprint) throw new Error("Source changed during capture; rerun before publishing assets.");
  const manifest = { provenance: "Actual current authenticated NeueBit UI with authored sample API fixtures. Indexing cadence, streaming cadence, coordinates, scores and values are illustrative; no live backend measurements or public runtime API requests.",
    capturedAt: new Date().toISOString(), sourceFingerprint, fingerprintAlgorithm: "sha256 of frontend/src excluding generated heroFilmTimings.ts, plus the three film scripts",
    sequence: ["Documents", "Search", "Chat", "Sources", "Vector Lab", "Documents"],
    encoding: "Native-resolution PNG capture; lossless FFV1 intermediate; one H.264 encode, 24fps, CRF 20, slow preset, yuv420p, faststart, no audio; four-frame dissolves; exact opening composition held at loop end.", assets };
  await writeFile(resolve(staged, "capture-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  const timings = Object.fromEntries(assets.map(asset => [asset.file.replace("neuebit-", "").replace(".mp4", ""), chapters]));
  const types = "// Generated by scripts/capture-hero-film.mjs and encode-hero-film.mjs.\nexport type HeroFilmScene = 'documents' | 'search' | 'chat' | 'sources' | 'vectors';\nexport type HeroSemanticWord = 'Ask' | 'Search' | 'Trace' | 'Inspect';\n";
  const output = `${types}export const heroFilmChapters: Record<'desktop-light' | 'desktop-dark' | 'mobile-light' | 'mobile-dark',\n  { scene: HeroFilmScene; word: HeroSemanticWord; start: number }[]> = ${JSON.stringify(timings, null, 2)};\n`;
  for (const asset of assets) for (const file of [asset.file, asset.poster.file]) await copyFile(resolve(staged, file), resolve(finalAssets, file));
  await copyFile(resolve(staged, "capture-manifest.json"), resolve(finalAssets, "capture-manifest.json"));
  const timingsPath = resolve(root, "src/components/marketing/heroFilmTimings.ts");
  if ((await readFile(timingsPath, "utf8")).replaceAll("\r\n", "\n") !== output) await writeFile(timingsPath, output);
  for (const asset of assets) for (const file of [asset.file, asset.poster.file]) await rm(resolve(staged, file));
  await rm(resolve(staged, "capture-manifest.json"));
  console.log("Published all four validated films, posters, manifest and chapters.");
} finally {
  await browser.close();
  await vite.close();
}
