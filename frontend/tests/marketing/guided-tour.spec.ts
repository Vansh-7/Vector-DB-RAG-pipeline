import { test, expect, stubApi, expectNoProductCode } from "../entry/fixtures";
import { appearance } from "../theme/fixtures";

async function openStory(page: import("@playwright/test").Page, reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
  const evidence = await stubApi(page);
  await page.goto((process.env.NEUEBIT_STORY_REVIEW_PATH || "/") + "#product");
  await expect(page.locator(".retrieval-proof-strip")).toBeAttached();
  await page.evaluate(() => document.fonts.ready);
  return evidence;
}
async function seek(page: import("@playwright/test").Page, p: number) {
  await page.locator("#product").evaluate((section,p) => {
    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height"));
    const shell = section.querySelector(".retrieval-story-shell") as HTMLElement;
    const bounds = section.getBoundingClientRect();
    scrollTo({top:bounds.top+scrollY-header+p*(bounds.height-shell.offsetHeight),behavior:"instant"});
  },p);
  await page.waitForTimeout(100);
}

test("the three-zone story connects an authored passage, semantic context and a grounded citation",async({page})=>{
  const {calls,scripts}=await openStory(page,true);
  const story=page.locator("#product");
  await expect(story.locator("h3")).toHaveText(["Your document","Find the right context","A grounded answer"]);
  await expect(story.locator(".retrieval-original-passage")).toHaveText("“Retrieval filters candidates to the authenticated user and searchable documents.”");
  await expect(story.locator(".retrieval-question")).toHaveText("How does retrieval work?");
  await expect(story.locator(".retrieval-selected-passage")).toContainText("Retrieval stays within your knowledge.");
  await expect(story.locator(".retrieval-answer")).toContainText("It filters the context to your knowledge and reranks the matches.");
  await expect(story.getByRole("button",{name:"Trace source 1: Product architecture.md",exact:true})).toBeEnabled();
  await expect(story.locator("[role=tab],video,canvas,.demo-workspace,[role=progressbar]")).toHaveCount(0);
  expect(calls).toEqual([]);expectNoProductCode(scripts);
});

for(const theme of ["light","dark"] as const)for(const [width,height] of [[1280,800],[1366,768],[1440,900],[1920,1080]]){
  test(theme+" "+width+"x"+height+" preserves the complete three-zone composition as native scroll reveals context",async({page})=>{
    await page.setViewportSize({width,height});await appearance(page,theme,theme);
    const {calls,scripts}=await openStory(page);
    const story=page.locator("#product"),scene=story.locator(".retrieval-proof-strip");
    await expect(story).toHaveAttribute("data-scroll-story","true");
    for(const p of [.07,.48,.62,.76,.98]){
      await seek(page,p);await expect(scene).toHaveAttribute("data-complete",String(p>=.96));
      const metadata=await scene.evaluate(el=>({
        frame:el.getBoundingClientRect().toJSON(),
        header:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height")),
        zones:[...el.querySelectorAll(".retrieval-zone")].map(node=>node.getBoundingClientRect().toJSON()),
        overflow:document.documentElement.scrollWidth-innerWidth,
      }));
      expect(metadata.overflow).toBe(0);expect(metadata.frame.top).toBeGreaterThanOrEqual(metadata.header);
      expect(metadata.frame.bottom).toBeLessThanOrEqual(height);
      for(let i=0;i<3;i++){
        const box=metadata.zones[i];
        expect(box.left).toBeGreaterThanOrEqual(metadata.frame.left-1);
        expect(box.right).toBeLessThanOrEqual(metadata.frame.right+1);
        expect(box.bottom).toBeLessThanOrEqual(metadata.frame.bottom+1);
        expect(box.top).toBeCloseTo(metadata.zones[0].top,1);
        if(i>0)expect(box.left).toBeGreaterThanOrEqual(metadata.zones[i-1].right);
      }
    }
    await page.mouse.wheel(0,-height/2);await expect(scene).toHaveAttribute("data-complete","false");
    await seek(page,.48);
    const frozen=await scene.locator("[data-semantic-node=query]").getAttribute("style");
    await page.waitForTimeout(400);
    expect(await scene.locator("[data-semantic-node=query]").getAttribute("style")).toBe(frozen);
    await seek(page,1);
    const header=await page.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height")));
    await page.mouse.wheel(0,200);
    await expect.poll(async()=>(await story.locator(".retrieval-story-shell").boundingBox())!.y).toBeLessThan(header-100);
    expect(calls).toEqual([]);expectNoProductCode(scripts);
  });
}

for(const theme of ["light","dark"] as const)for(const width of [320,375,390,430])test(theme+" "+width+"px uses complete natural reading flow",async({page})=>{
  await page.setViewportSize({width,height:844});await appearance(page,theme,theme);await openStory(page);
  await expect(page.locator("#product")).toHaveAttribute("data-scroll-story","false");
  await expect(page.locator(".retrieval-canvas")).toHaveAttribute("data-state","complete");
  const rows=await page.locator(".retrieval-zone").evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  expect(rows).toHaveLength(3);
  for(let i=1;i<3;i++)expect(rows[i].top).toBeGreaterThan(rows[i-1].bottom);
  for(const detail of await page.locator("#product [data-relationship]").all()){
    await expect(detail).toHaveCSS("opacity","1");
    expect(await detail.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});

test("completed source relationships follow a logical keyboard order with visible focus",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);await seek(page,0);
  await expect(page.locator(".retrieval-answer-citation")).toBeDisabled();
  await expect(page.locator(".retrieval-source-identity")).toBeDisabled();
  await seek(page,.98);await page.locator("#product").evaluate(el=>(el as HTMLElement).focus({preventScroll:true}));
  for(const relationship of ["document","retrieval","passage","citation","source"]){
    await page.keyboard.press("Tab");const target=page.locator('[data-relationship="'+relationship+'"]');
    await expect(target).toBeFocused();await expect(target).toHaveCSS("outline-width","2px");
  }
  await page.keyboard.press("Enter");
  await expect(page.locator("#product").getByRole("status")).toContainText("Citation 1 supports the highlighted original passage");
});

test("reduced motion completes the relationships immediately when changed mid-scroll",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);await seek(page,.44);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(page.locator("#product")).toHaveAttribute("data-scroll-story","false");
  await expect(page.locator(".retrieval-canvas")).toHaveAttribute("data-state","complete");
  await expect(page.locator(".retrieval-provenance")).toHaveCSS("opacity","1");
  await expect(page.locator(".retrieval-answer-citation")).toBeEnabled();
  await expect(page.locator(".retrieval-provenance-tracer")).toHaveCount(0);
});

for(const width of [390,1024,1440])test(width+"px enlarged text remains readable without a compressed sticky canvas",async({page})=>{
  await page.setViewportSize({width,height:900});await openStory(page);
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  await expect(page.locator("#product")).toHaveAttribute("data-scroll-story","false");
  await expect(page.locator(".retrieval-document")).toHaveCSS("opacity","1");
  await expect(page.locator(".retrieval-selected-passage")).toHaveCSS("opacity","1");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
});