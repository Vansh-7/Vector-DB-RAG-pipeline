import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

const stageNames = ["Ask", "Embed", "Retrieve", "Isolate", "Rerank", "Generate", "Cite"];
const artifacts = [
  ["User question", "Retrieval query"], ["Question text", "Query vector"],
  ["Query vector", "Candidate passages"], ["ANN candidates", "Tenant-safe candidates"],
  ["Question + authorized passages", "Ranked context"], ["Question + ranked context", "Grounded answer"],
  ["Answer + source passages", "Answer + sources"],
];

for (const theme of ["light", "dark"] as const) for (const [width, height] of [[1440,900],[1280,800],[1024,768]]) {
  test(`${theme} ${width}×${height}: every architecture transformation fits the technical viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" });
    const { calls, scripts } = await stubApi(page); await page.goto("/#architecture");
    const pipeline = page.locator(".architecture-pipeline");
    await pipeline.evaluate(element => scrollTo({ top: scrollY + element.getBoundingClientRect().top - 85, behavior: "instant" }));
    const original = (await pipeline.boundingBox())!;
    expect(original.height).toBeLessThanOrEqual(height - 110);
    expect(original.height).toBeGreaterThanOrEqual(560);
    const vector = (await page.locator(".vector-reveal-figure").boundingBox())!;
    expect(original.x).toBeCloseTo(vector.x, 0); expect(original.width).toBeCloseTo(vector.width, 0);
    const rail = await pipeline.locator(".pipeline-selector button").evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().top));
    expect(Math.max(...rail) - Math.min(...rail)).toBeLessThan(1);
    for (const [index, stage] of stageNames.entries()) {
      const button = pipeline.getByRole("button", { name: `0${index + 1} ${stage}` }); await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
      await expect(pipeline.locator(".machine-region h4")).toHaveText(["Input", "Engine", "Output"]);
      await expect(pipeline.locator(".machine-artifact h5")).toHaveText(artifacts[index]);
      const geometry = await pipeline.evaluate(element => {
        const box = element.getBoundingClientRect();
        const content = [...element.querySelectorAll<HTMLElement>(".pipeline-selector button, .pipeline-story, .machine-region, .machine-console")].map(child => child.getBoundingClientRect());
        const scrollers = [...element.querySelectorAll<HTMLElement>("*")].filter(child => {
          const style = getComputedStyle(child);
          return (/auto|scroll/.test(style.overflowY) && child.scrollHeight > child.clientHeight + 1) || (/auto|scroll/.test(style.overflowX) && child.scrollWidth > child.clientWidth + 1);
        });
        return { height: box.height, bottom: box.bottom, contained: content.every(child => child.top >= box.top - 1 && child.bottom <= box.bottom + 1 && child.left >= box.left - 1 && child.right <= box.right + 1), nestedScroll: scrollers.length,
          overflow: element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1, pageOverflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(geometry.height).toBeCloseTo(original.height, 0); expect(geometry.bottom).toBeLessThanOrEqual(height);
      expect(geometry.contained, `${stage} remains inside the console`).toBe(true);
      expect(geometry.overflow, `${stage} content fits without clipping`).toBe(false);
      expect(geometry.nestedScroll).toBe(0); expect(geometry.pageOverflow).toBe(false);
    }
    expect(calls).toEqual([]); expectNoProductCode(scripts);
  });
}

test("filtering narrows the authored set before reranking; source provenance survives generation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto("/#architecture");
  const pipeline = page.locator(".architecture-pipeline");
  await pipeline.getByRole("button", { name: "04 Isolate" }).click();
  await expect(pipeline.locator(".machine-region").first().locator(".machine-passages li")).toHaveCount(5);
  await expect(pipeline.locator(".machine-gates > div > span")).toHaveText(["User ownership", "Document status"]);
  await expect(pipeline.locator(".machine-region").last().locator(".machine-passages code")).toHaveText(["sample-18","sample-16","sample-14"]);
  await pipeline.getByRole("button", { name: "05 Rerank" }).click();
  const order = ["sample-16", "sample-18"];
  await expect(pipeline.locator(".machine-ranked li")).toHaveText(order);
  await pipeline.getByRole("button", { name: "06 Generate" }).click();
  await expect(pipeline.locator(".machine-ranked li")).toHaveText(order);
  await pipeline.getByRole("button", { name: "07 Cite" }).click();
  await expect(pipeline.locator(".machine-source")).toContainText("RAG design.md");
  await expect(pipeline.locator(".machine-source")).toContainText("sample-16 · sample-18");
});

for (const theme of ["light","dark"] as const) test(`${theme} mobile and enlarged text use natural flow with all controls visible`, async ({ page }) => {
  await appearance(page, theme, theme); await page.emulateMedia({ reducedMotion: "reduce" }); await stubApi(page); await page.goto("/#architecture");
  const pipeline = page.locator(".architecture-pipeline");
  for (const [width, size] of [[390,"100%"],[390,"200%"],[1440,"200%"]] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(size => { document.documentElement.style.fontSize = size; }, size);
    for (const [index, stage] of stageNames.entries()) {
      await pipeline.getByRole("button", { name: `0${index + 1} ${stage}` }).click();
      const fits = await pipeline.evaluate(element => {
        const box = element.getBoundingClientRect();
        return [...element.querySelectorAll<HTMLElement>(".machine-region, .machine-console, .pipeline-selector button")].every(child => { const b = child.getBoundingClientRect(); return b.bottom <= box.bottom + 1 && b.right <= box.right + 1; })
          && element.scrollHeight <= element.clientHeight + 1 && document.documentElement.scrollWidth <= innerWidth;
      });
      expect(fits, `${width}px ${size} ${stage}`).toBe(true);
    }
  }
  await expect(pipeline).toHaveAttribute("data-presentation", "static");
  await expect(pipeline.locator(".pipeline-playback")).toHaveCount(0);
});

test("offscreen and hidden time do not consume architecture dwell; reduced motion stops automatic advancement", async ({ page }) => {
  await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({reducedMotion:"no-preference"}); await stubApi(page); await page.goto("/#architecture");
  const pipeline = page.locator(".architecture-pipeline"); await pipeline.scrollIntoViewIfNeeded();
  await expect(pipeline).toHaveAttribute("data-presentation","playing"); await page.clock.install();
  await pipeline.getByRole("button",{name:"04 Isolate"}).click();
  await pipeline.getByRole("button",{name:"Resume architecture sequence"}).click();
  await page.evaluate(() => { Object.defineProperty(document,"hidden",{configurable:true,get:()=>true}); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(pipeline).toHaveAttribute("data-presentation","suspended"); await page.clock.runFor(15000);
  await expect(pipeline).toHaveAttribute("data-active-stage","isolate");
  await page.evaluate(() => { Object.defineProperty(document,"hidden",{configurable:true,get:()=>false}); document.dispatchEvent(new Event("visibilitychange")); scrollTo(0,0); });
  await expect(pipeline).toHaveAttribute("data-presentation","suspended"); await page.clock.runFor(15000);
  await expect(pipeline).toHaveAttribute("data-active-stage","isolate");
  await pipeline.scrollIntoViewIfNeeded(); await expect(pipeline).toHaveAttribute("data-presentation","playing");
  await page.emulateMedia({reducedMotion:"reduce"}); await expect(pipeline).toHaveAttribute("data-presentation","static"); await page.clock.runFor(15000);
  await expect(pipeline).toHaveAttribute("data-active-stage","isolate");
  await expect(pipeline).toHaveAttribute("data-presentation","static");
  await pipeline.getByRole("button",{name:"05 Rerank"}).click(); await expect(pipeline).toHaveAttribute("data-active-stage","rerank");
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
});
