import { test, expect, stubApi, seedSession } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";
import { heroFilmChapters } from "../../src/components/marketing/heroFilmTimings";

test("actual product film autoplays muted, loops without replay UI, and keeps its frame stable", async ({ page }) => {
  await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({reducedMotion:"no-preference"}); const {calls}=await stubApi(page); await page.goto("/");
  const film=page.locator(".product-film");
  // Compare settled geometry: the intentional entrance includes a .985 scale.
  await expect(page.locator('[data-hero-part="preview"]')).toHaveCSS("transform", "none");
  await expect(film).toHaveAttribute("data-presentation","playing"); const start=await film.boundingBox();
  const video = film.locator("video");
  expect(await video.evaluate(element => ({ muted: element.muted, loop: element.loop, inline: element.playsInline, controls: element.controls }))).toEqual({ muted: true, loop: true, inline: true, controls: false });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(.3);
  await expect(film.getByRole("button")).toHaveCount(0);
  await expect(film.locator(".film-caption, .film-playback")).toHaveCount(0);
  await expect(film.locator(".film-progress")).toHaveCount(0);
  await video.evaluate(element => { element.currentTime = element.duration - .15; });
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeLessThan(1);
  await expect(film).toHaveAttribute("data-scene", "documents");
  expect((await film.boundingBox())!.height).toBeCloseTo(start!.height,0);
  expect(calls).toEqual([]);
});

test("actual film scene metadata follows seeking and suspended playback", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/"); const film=page.locator(".product-film");
  const video = film.locator("video");
  await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(.5);
  const start = heroFilmChapters["desktop-light"].find(chapter => chapter.scene === "sources")!.start;
  await video.evaluate(async (element, time) => {
    element.pause();
    await new Promise(done => { element.addEventListener("seeked", done, { once: true }); element.currentTime = time; });
  }, start + .5);
  await expect(film).toHaveAttribute("data-scene", "sources");
  await page.waitForTimeout(3000);
  await expect(film).toHaveAttribute("data-scene", "sources");
  await video.evaluate(element => element.play());
  await expect(film).toHaveAttribute("data-scene", "vectors", { timeout: 5000 });
});

for (const width of [1440, 390]) test(`${width}px film follows the global theme and loads only its responsive asset`, async ({page}) => {
  await page.setViewportSize({width,height:1000}); await appearance(page,"light","light"); await page.emulateMedia({reducedMotion:"no-preference"});
  const {calls,scripts}=await stubApi(page), movies: string[]=[];
  page.on("request", request => { if (request.url().endsWith(".mp4")) movies.push(request.url()); });
  await page.goto("/"); const video=page.locator(".film-video"), format=width===390?"mobile":"desktop";
  await expect(video).toHaveAttribute("src",`/product/film/neuebit-${format}-light.mp4`);
  if (width===390) await page.getByRole("button",{name:"Open navigation"}).click();
  await page.getByRole("button",{name:"Switch to dark theme"}).click();
  await expect(video).toHaveAttribute("src",`/product/film/neuebit-${format}-dark.mp4`);
  await expect(video).toHaveAttribute("poster",`/product/film/neuebit-${format}-dark.webp`);
  expect(movies.every(url => url.includes(`neuebit-${format}-`))).toBe(true);
  expect(calls).toEqual([]); expect(scripts.some(url=>/AppShell-/.test(url))).toBe(false);
});

test("ordinary scrolling over the film continues the page", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/");
  const canvas=page.locator(".film-screen");
  expect(await canvas.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
  await canvas.hover(); const before=await page.evaluate(()=>scrollY); await page.mouse.wheel(0,500);
  await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(before+100);
});

test("early local job interactions reveal complete readable states and do not advance another section", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/");
  const search=page.locator("#knowledge-search"); await search.scrollIntoViewIfNeeded(); await search.locator(".job-search-matches button").first().click();
  await expect(search.locator(".job-search-matches")).toHaveCSS("opacity","1"); await expect(search.locator(".job-search-query > span")).toBeVisible();
  const chat=page.locator("#knowledge-chat"); await chat.scrollIntoViewIfNeeded(); await chat.getByRole("button",{name:"2 sources"}).click();
  await expect(chat.locator(".job-question")).toHaveCSS("opacity","1"); await expect(chat.locator(".job-answer")).toHaveCSS("opacity","1");
  await expect(chat.getByRole("button",{name:"Source 1"})).toBeVisible();
  await expect(page.locator(".product-film")).toHaveAttribute("data-presentation","paused");
});

test("architecture is a compact process rail with a consistent authorized passage set", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"}); await stubApi(page); await page.goto("/#architecture");
  const pipeline=page.locator(".architecture-pipeline");
  await expect(pipeline.getByRole("button",{name:"01 Ask"})).toHaveCSS("border-top-width","0px");
  await expect(pipeline.locator(".pipeline-detail")).toHaveCSS("padding-top","0px");
  await pipeline.getByRole("button",{name:"04 Isolate"}).click(); const active=pipeline.locator('.machine-state:not([aria-hidden="true"])');
  await expect(active.locator(".machine-region").last()).toContainText("sample-14");
  await expect(active.locator(".machine-region").last()).not.toContainText("sample-7");
  await pipeline.getByRole("button",{name:"05 Rerank"}).click(); await expect(active.locator(".machine-ranked li")).toHaveText(["sample-16", "sample-18"]);
});

test("film pauses offscreen and when the document is hidden", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/"); const film=page.locator(".product-film");
  await expect(film).toHaveAttribute("data-presentation","playing"); await page.locator(".marketing-footer").scrollIntoViewIfNeeded(); await expect(film).toHaveAttribute("data-presentation","paused");
  const position=await film.locator("video").evaluate(element => element.currentTime); await page.waitForTimeout(1500); expect(await film.locator("video").evaluate(element => element.currentTime)).toBe(position);
  await page.evaluate(() => { Object.defineProperty(document,"hidden",{configurable:true,get:()=>true}); document.dispatchEvent(new Event("visibilitychange")); scrollTo(0,0); });
  await expect(film).toHaveAttribute("data-presentation","paused"); await page.waitForTimeout(1000); expect(await film.locator("video").evaluate(element => element.currentTime)).toBe(position);
  await page.evaluate(() => { Object.defineProperty(document,"hidden",{configurable:true,get:()=>false}); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(film).toHaveAttribute("data-presentation","playing");
});

test("reduced motion uses a static poster and headline without downloading video or showing player controls", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"}); await stubApi(page); const movies: string[] = [];
  page.on("request", request => { if (request.url().endsWith(".mp4")) movies.push(request.url()); });
  await page.goto("/"); const film=page.locator(".product-film");
  await expect(film).toHaveAttribute("data-presentation","complete");
  expect(movies).toEqual([]); await expect(film.locator("video")).not.toHaveAttribute("src");
  await expect(film.getByRole("button")).toHaveCount(0);
  await expect(page.locator('.hero-headline-phrase[data-active="true"]')).toHaveText("Ask questions");
  await page.emulateMedia({reducedMotion:"no-preference"});
  await expect(film).toHaveAttribute("data-presentation","playing"); expect(movies.length).toBeGreaterThan(0);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(film).toHaveAttribute("data-presentation","complete");
});

test("architecture loops until direct interaction; selection stays stopped until explicit resume", async ({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/#architecture");
  const pipeline=page.locator(".architecture-pipeline"); await pipeline.scrollIntoViewIfNeeded(); const height=(await pipeline.boundingBox())!.height;
  await expect(pipeline).toHaveAttribute("data-presentation","playing");
  await expect(pipeline.locator("[data-pipeline-node]").last()).toHaveCSS("transform","none");
  await page.clock.install({time:new Date("2026-10-04T12:00:00Z")});
  await page.clock.pauseAt(new Date("2026-10-04T12:00:01Z"));
  await pipeline.getByRole("button",{name:"07 Cite"}).click();
  await expect(pipeline).toHaveAttribute("data-presentation","paused");
  await page.clock.runFor(20000); await expect(pipeline).toHaveAttribute("data-active-stage","cite");
  await pipeline.getByRole("button",{name:"Resume architecture sequence"}).click();
  await page.clock.runFor(2100); await expect(pipeline).toHaveAttribute("data-active-stage","ask");
  await page.clock.runFor(5400); await expect(pipeline).toHaveAttribute("data-active-stage","ask");
  await page.clock.runFor(300); await expect(pipeline).toHaveAttribute("data-active-stage","embed");
  const ask=pipeline.getByRole("button",{name:"01 Ask"}); await ask.focus(); await page.keyboard.press("ArrowRight"); await expect(pipeline).toHaveAttribute("data-active-stage","embed");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight"); await expect(pipeline).toHaveAttribute("data-active-stage","isolate");
  await expect(pipeline.locator('.machine-state')).toContainText("Bob · Ready");
  await page.clock.runFor(400); expect((await pipeline.boundingBox())!.height).toBeCloseTo(height,0);
  await page.clock.runFor(20000); await expect(pipeline).toHaveAttribute("data-active-stage","isolate");
  await pipeline.getByRole("button",{name:"Resume architecture sequence"}).click();
  await page.clock.runFor(2100); await expect(pipeline).toHaveAttribute("data-active-stage","rerank");
  await pipeline.getByRole("button",{name:"05 Rerank"}).hover();
  await page.clock.runFor(2000); await expect(pipeline).toHaveAttribute("data-active-stage","generate");
  await page.clock.runFor(2000); await expect(pipeline).toHaveAttribute("data-active-stage","cite");
  await page.clock.runFor(2000); await expect(pipeline).toHaveAttribute("data-active-stage","ask");
  await expect(pipeline.getByRole("button",{name:/Replay/})).toHaveCount(0);
  await expect(page.locator(".product-film")).toHaveAttribute("data-presentation","paused");
});

test("landing and footer logout preserve appearance and use the existing session boundary", async ({page}) => {
  await appearance(page,"dark","dark"); await seedSession(page); const {calls}=await stubApi(page); await page.goto("/");
  const nav=page.getByRole("navigation",{name:"Public navigation"}), account=page.getByRole("navigation",{name:"Footer account navigation"});
  await expect(nav.getByRole("button",{name:"Log out"})).toBeVisible(); await expect(account.getByRole("link",{name:"Open Neuebit"})).toHaveAttribute("href","/app");
  await account.getByRole("button",{name:"Log out"}).click(); await expect(nav.getByRole("link",{name:"Sign in",exact:true})).toBeVisible();
  await expect(account.getByRole("link",{name:"Get started"})).toHaveAttribute("href","/auth?mode=register");
  expect(await page.evaluate(()=>localStorage.getItem("neuebit-theme"))).toBe("dark"); expect(calls.map(call=>call.path)).toEqual(["/auth/me"]);
});
