import type { Page } from "@playwright/test";
import { test, expect, stubApi } from "../entry/fixtures";

async function openStory(page:Page,theme:"light"|"dark"="light",reduced=false) {
  await page.emulateMedia({ colorScheme:theme,reducedMotion:reduced?"reduce":"no-preference" });
  await page.addInitScript(theme=>localStorage.setItem("neuebit-theme",theme),theme);
  const evidence=await stubApi(page);
  await page.goto("/#product");
  await expect(page.locator(".retrieval-proof-strip")).toBeVisible();
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(150);
  return evidence;
}

async function seek(page:Page,progress:number) {
  await page.locator("#product").evaluate((section,progress)=>{
    const header=parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height"));
    const shell=section.querySelector<HTMLElement>(".retrieval-story-shell")!;
    scrollTo({top:section.getBoundingClientRect().top+scrollY-header+progress*((section as HTMLElement).offsetHeight-shell.offsetHeight),behavior:"instant"});
  },progress);
  await page.waitForTimeout(100);
}

for (const theme of ["light","dark"] as const) for (const [width,height] of [[1920,1080],[1440,900],[1280,800],[1024,768],[768,1024],[430,932],[390,844],[320,740]]) {
  test(theme+" "+width+"px preserves three zones, readable geometry, and local citation behavior",async({page})=>{
    await page.setViewportSize({width,height});
    const {calls,scripts}=await openStory(page,theme);
    const story=page.locator("#product"),scene=story.locator(".retrieval-proof-strip");
    if (await story.getAttribute("data-scroll-story")==="true") await seek(page,.98);
    await expect(scene).toHaveAttribute("data-complete","true");
    await expect(story.locator("h3")).toHaveText(["Your document","Find the right context","A grounded answer"]);
    await expect(story.locator("[data-semantic-node]")).toHaveCount(9);
    await expect(story.locator(".retrieval-original-passage")).toHaveText("“Retrieval filters candidates to the authenticated user and searchable documents.”");
    await expect(story.locator(".retrieval-selected-passage > p")).toHaveText(await story.locator(".retrieval-original-passage").innerText());
    await expect(story.locator(".retrieval-payoff")).toHaveText("Every answer stays traceable to its source.");
    await expect(story.locator(".retrieval-payoff")).toHaveCSS("opacity","1");
    await expect(story.locator(".retrieval-selected-passage")).toHaveCSS("border-top-width","1px");
    const tinted=await story.locator(".retrieval-selected-passage").evaluate(node=>getComputedStyle(node).backgroundColor!==getComputedStyle(document.querySelector(".retrieval-document")!).backgroundColor);
    expect(tinted).toBe(true);
    await expect(scene.locator(".retrieval-grounded-phrase")).toHaveCSS("text-decoration-line","none");
    const selection=await scene.locator(".retrieval-grounded-phrase").evaluate(node=>({background:getComputedStyle(node).backgroundColor,fragmented:getComputedStyle(node).boxDecorationBreak}));
    expect(selection.background).not.toBe("rgba(0, 0, 0, 0)");expect(selection.fragmented).toBe("clone");
    const enclosed=await scene.locator(".retrieval-semantic-field").evaluate(node=>{
      const oval=node.querySelector<SVGEllipseElement>("ellipse.retrieval-neighborhood")!;
      return [...node.querySelectorAll<SVGCircleElement>("[data-semantic-node=neighbor],[data-semantic-node=selected]")].every(point=>
        ((Math.abs(point.cx.baseVal.value-oval.cx.baseVal.value)+point.r.baseVal.value)/oval.rx.baseVal.value)**2+
        ((Math.abs(point.cy.baseVal.value-oval.cy.baseVal.value)+point.r.baseVal.value)/oval.ry.baseVal.value)**2<1);
    });
    expect(enclosed).toBe(true);
    await expect(story.locator(".retrieval-answer")).toContainText("It filters the context to your knowledge and reranks the matches.");
    const geometry=await story.evaluate(section=>({
      overflow:document.documentElement.scrollWidth-innerWidth,
      scrolling:section.getAttribute("data-scroll-story"),
      header:parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--marketing-header-height")),
      shell:section.querySelector(".retrieval-story-shell")!.getBoundingClientRect().toJSON(),
      zones:[...section.querySelectorAll(".retrieval-zone")].map(node=>node.getBoundingClientRect().toJSON()),
      nested:[...section.querySelectorAll<HTMLElement>("*")].filter(node=>/auto|scroll/.test(getComputedStyle(node).overflowY)&&node.scrollHeight>node.clientHeight+1).length,
      children:[...section.querySelectorAll<HTMLElement>("[data-relationship]")].map(node=>({width:node.clientWidth,scrollWidth:node.scrollWidth})),
    }));
    expect(geometry.overflow).toBe(0);expect(geometry.nested).toBe(0);
    expect(geometry.children.every(node=>node.scrollWidth<=node.width+1)).toBe(true);
    if (width>=1024) {
      expect(geometry.zones[0].top).toBeCloseTo(geometry.zones[1].top,1);
      expect(geometry.zones[1].top).toBeCloseTo(geometry.zones[2].top,1);
      if (geometry.scrolling==="true") {
        expect(geometry.shell.top).toBeGreaterThanOrEqual(geometry.header-1);
        expect(geometry.shell.bottom).toBeLessThanOrEqual(height);
      }
      const aligned=await scene.evaluate(node=>{
        const doc=node.querySelector(".retrieval-document")!.getBoundingClientRect();
        const answer=node.querySelector(".retrieval-answer-object")!.getBoundingClientRect();
        const payoff=node.querySelector(".retrieval-payoff")!.getBoundingClientRect();
        const frame=node.getBoundingClientRect();
        return {topDifference:Math.abs(doc.top-answer.top),heightDifference:Math.abs(doc.height-answer.height),payoffCenter:payoff.left+payoff.width/2,frameCenter:frame.left+frame.width/2};
      });
      expect(aligned.topDifference).toBeLessThan(1);expect(aligned.heightDifference).toBeLessThan(2);
      expect(aligned.payoffCenter).toBeCloseTo(aligned.frameCenter,1);
      for (const flow of ["document-connection","answer-connection","provenance"]) {
        await expect(scene.locator(".retrieval-"+flow+" .retrieval-flow-arrow")).toHaveCSS("opacity","1");
      }
    } else {
      expect(geometry.scrolling).toBe("false");
      expect(geometry.zones[1].top).toBeGreaterThan(geometry.zones[0].bottom);
      expect(geometry.zones[2].top).toBeGreaterThan(geometry.zones[1].bottom);
      await expect(scene.locator(".retrieval-mobile-arrow").first()).toBeVisible();
      const citation=await scene.locator(".retrieval-answer-citation").boundingBox();
      expect(citation!.width).toBeGreaterThanOrEqual(44);expect(citation!.height).toBeGreaterThanOrEqual(44);
    }
    await scene.getByRole("button",{name:"Trace citation 1 to its supporting passage",exact:true}).click();
    await expect(scene.getByRole("status")).toContainText("highlighted original passage in Product architecture.md");
    if (width<1024) await expect(scene.getByRole("status")).toBeVisible();
    expect(calls).toEqual([]);
    expect(scripts.filter(url=>/AppShell|\/d3-|\/VectorLab-/.test(url))).toEqual([]);
  });
}

test("selection, semantic context, and answer reveal in order and reverse with native scroll",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);
  const scene=page.locator(".retrieval-proof-strip");
  await seek(page,.07);
  const widths=await scene.locator(".retrieval-selection-line").evaluateAll(nodes=>nodes.map(node=>parseFloat(getComputedStyle(node).width)));
  expect(widths[0]).toBeGreaterThan(20);expect(widths.at(-1)).toBe(0);
  await seek(page,.16);
  expect(await scene.locator(".retrieval-selection-line").evaluateAll(nodes=>nodes.every(node=>parseFloat(getComputedStyle(node).width)>20))).toBe(true);
  await seek(page,.48);
  const opacity=async(selector:string)=>Number(await scene.locator(selector).evaluate(node=>getComputedStyle(node).opacity));
  expect(await opacity("[data-semantic-node=query]")).toBe(1);
  expect(await opacity(".retrieval-passage-marker")).toBe(0);
  await seek(page,.62);
  expect(await opacity(".retrieval-passage-marker")).toBe(1);
  expect(await opacity(".retrieval-selected-passage h4 > span:last-child")).toBeGreaterThan(await opacity(".retrieval-selected-passage > p"));
  await seek(page,.76);
  expect(await opacity(".retrieval-answer > p:first-child")).toBeGreaterThan(await opacity(".retrieval-answer > p:last-child"));
  await seek(page,.98);await expect(scene).toHaveAttribute("data-complete","true");
  const zones=await scene.locator(".retrieval-zone").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
  await page.mouse.wheel(0,-250);
  await expect(scene).toHaveAttribute("data-complete","false");
  await seek(page,.48);
  expect(await opacity(".retrieval-passage-marker")).toBe(0);
  expect(await opacity("[data-semantic-node=query]")).toBe(1);
  const reversed=await scene.locator(".retrieval-zone").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
  expect(reversed).toEqual(zones);
  await seek(page,.98);await page.mouse.move(10,80);await page.waitForTimeout(350);
  const still=await scene.evaluate(node=>[...node.querySelectorAll("[style]")].map(n=>n.getAttribute("style")));
  await page.waitForTimeout(800);
  expect(await scene.evaluate(node=>[...node.querySelectorAll("[style]")].map(n=>n.getAttribute("style")))).toEqual(still);
  expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==="running").length)).toBe(0);
});

test("arrow tips follow scroll progress, context feeds the answer, and provenance returns underneath to the original citation",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);
  const scene=page.locator(".retrieval-proof-strip");
  const incoming=scene.locator(".retrieval-document-connection .retrieval-flow-arrow");
  await seek(page,.07);await expect(incoming).toHaveCSS("opacity","0");
  await expect(scene.locator(".retrieval-payoff")).toHaveCSS("opacity","0");
  const transform=()=>incoming.evaluate(node=>getComputedStyle(node).transform);
  await seek(page,.25);const partial=await transform();
  await seek(page,.48);const forward=await transform();
  expect(partial).not.toBe("none");expect(forward).not.toBe("none");
  expect(partial).not.toBe(forward);
  await seek(page,.25);expect(await transform()).toBe(partial);
  await seek(page,.76);await expect(scene.locator(".retrieval-answer-connection .retrieval-flow-arrow")).not.toHaveCSS("opacity","0");
  await expect(scene.locator(".retrieval-provenance .retrieval-flow-arrow")).toHaveCSS("opacity","0");
  await seek(page,.98);
  const arrowErrors=await scene.locator(".retrieval-flow-arrow").evaluateAll(nodes=>nodes.map(node=>{
    const arrow=node as SVGGElement;
    const path=arrow.parentElement!.querySelector<SVGPathElement>(":scope > path")!;
    const endpoint=path.getPointAtLength(path.getTotalLength()).matrixTransform(path.getScreenCTM()!);
    const tip=new DOMPoint(0,0).matrixTransform(arrow.getScreenCTM()!);
    return Math.hypot(endpoint.x-tip.x,endpoint.y-tip.y);
  }));
  expect(arrowErrors.every(error=>error<1)).toBe(true);
  const geometry=await scene.evaluate(node=>{
    const frame=node.getBoundingClientRect();
    const source=node.querySelector(".retrieval-origin-number")!.getBoundingClientRect();
    const citation=node.querySelector(".retrieval-source-identity > .retrieval-citation-number")!.getBoundingClientRect();
    const document=node.querySelector(".retrieval-document")!.getBoundingClientRect();
    const payoff=node.querySelector(".retrieval-payoff")!.getBoundingClientRect();
    const passage=node.querySelector(".retrieval-selected-passage")!.getBoundingClientRect();
    const answer=node.querySelector(".retrieval-answer-object")!.getBoundingClientRect();
    const sample=(selector:string)=>{
      const path=node.querySelector<SVGPathElement>(selector)!;const length=path.getTotalLength();
      return {start:path.getPointAtLength(0),end:path.getPointAtLength(length),before:path.getPointAtLength(length-1)};
    };
    const forward=sample(".retrieval-answer-connection > path"),returning=sample(".retrieval-provenance > path");
    const points=(selector:string)=>{
      const path=node.querySelector<SVGPathElement>(selector)!;const length=path.getTotalLength();
      return Array.from({length:151},(_,i)=>path.getPointAtLength(length*i/150));
    };
    const incoming=points(".retrieval-document-connection > path");
    const returnPoints=points(".retrieval-provenance > path");
    const clearance=Math.min(...returnPoints.map(point=>Math.min(...incoming.map(other=>Math.hypot(point.x-other.x,point.y-other.y)))));
    return {forwardStart:forward.start.x+frame.left,forwardEnd:forward.end.x+frame.left,passageRight:passage.right,answerLeft:answer.left,
      forwardBeforeX:forward.before.x,forwardEndX:forward.end.x,forwardBeforeY:forward.before.y,forwardEndY:forward.end.y,clearance,
      returnStartX:returning.start.x+frame.left,returnStartY:returning.start.y+frame.top,
      returnEndX:returning.end.x+frame.left,returnEndY:returning.end.y+frame.top,returnBeforeX:returning.before.x+frame.left,returnBeforeY:returning.before.y+frame.top,
      returnBottom:Math.max(...returnPoints.map(point=>point.y))+frame.top,
      sourceCenter:source.left+source.width*.5,sourceBottom:source.bottom,
      citationCenter:citation.left+citation.width*.5,citationBottom:citation.bottom,objectsBottom:Math.max(document.bottom,answer.bottom),payoffTop:payoff.top};
  });
  expect(geometry.forwardStart).toBeCloseTo(geometry.passageRight+3,0);
  expect(geometry.forwardEnd).toBeCloseTo(geometry.answerLeft-3,0);
  expect(geometry.forwardBeforeX).toBeLessThan(geometry.forwardEndX);
  expect(geometry.forwardBeforeY).toBeCloseTo(geometry.forwardEndY,1);
  expect(geometry.clearance).toBeGreaterThan(8);
  expect(geometry.returnStartX).toBeCloseTo(geometry.citationCenter,0);
  expect(geometry.returnStartY).toBeCloseTo(geometry.citationBottom+4,0);
  expect(geometry.returnEndX).toBeCloseTo(geometry.sourceCenter,0);
  expect(geometry.returnEndY).toBeCloseTo(geometry.sourceBottom+7,0);
  expect(geometry.returnBeforeX).toBeCloseTo(geometry.returnEndX,1);
  expect(geometry.returnBeforeY).toBeGreaterThan(geometry.returnEndY);
  expect(geometry.returnBottom).toBeGreaterThan(geometry.objectsBottom+20);
  expect(geometry.returnBottom).toBeLessThan(geometry.payoffTop-12);
  await expect(scene.locator(".retrieval-payoff")).toHaveCSS("opacity","1");
});

test("hover and keyboard emphasize relationships without moving the composition; provenance traces once",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);await seek(page,.98);
  const scene=page.locator(".retrieval-proof-strip");
  const bounds=await scene.boundingBox();
  for(const relationship of ["document","retrieval","passage","citation","source"]) {
    const target=scene.locator('[data-relationship="'+relationship+'"]');
    await target.hover();await expect(scene).toHaveAttribute("data-emphasis",relationship);
    expect(await scene.boundingBox()).toEqual(bounds);
  }
  await expect(scene).toHaveAttribute("data-trace","arrived");
  await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(0);
  await expect(scene.locator(".retrieval-provenance")).toHaveCSS("stroke-opacity","0.95");
  await page.mouse.move(10,80);
  await page.locator("#product").evaluate(node=>(node as HTMLElement).focus({preventScroll:true}));
  for(const relationship of ["document","retrieval","passage","citation","source"]) {
    await page.keyboard.press("Tab");
    const target=scene.locator('[data-relationship="'+relationship+'"]');
    await expect(target).toBeFocused();await expect(target).toHaveCSS("outline-width","2px");
    await expect(scene).toHaveAttribute("data-emphasis",relationship);
  }
  await page.keyboard.press("Enter");await expect(scene.getByRole("status")).toContainText("Citation 1 supports");
});

for(const theme of ["light","dark"] as const) test(theme+" reduced motion shows complete relationships and never starts a tracer",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page,theme,true);
  const story=page.locator("#product"),scene=story.locator(".retrieval-proof-strip");
  await expect(story).toHaveAttribute("data-scroll-story","false");
  await expect(scene).toHaveAttribute("data-complete","true");
  await expect(scene.locator(".retrieval-provenance")).toHaveCSS("opacity","1");
  await scene.locator(".retrieval-source-identity").focus();
  await expect(scene).toHaveAttribute("data-emphasis","source");
  await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(0);
  expect(await scene.evaluate(node=>node.getAnimations({subtree:true}).filter(animation=>animation.playState==="running").length)).toBe(0);
});

for(const width of [390,1024,1440]) test(width+"px enlarged text preserves a readable complete natural flow",async({page})=>{
  await page.setViewportSize({width,height:900});await openStory(page);
  await page.evaluate(()=>document.documentElement.style.fontSize="200%");
  await expect(page.locator("#product")).toHaveAttribute("data-scroll-story","false");
  await expect(page.locator(".retrieval-proof-strip")).toHaveAttribute("data-complete","true");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBe(0);
  const heights=await page.locator(".retrieval-zone").evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().toJSON()));
  expect(heights[1].top).toBeGreaterThan(heights[0].bottom);
  expect(heights[2].top).toBeGreaterThan(heights[1].bottom);
});

test("changing motion preference during a trace leaves a still, complete, usable citation",async({page})=>{
  await page.setViewportSize({width:1440,height:900});await openStory(page);await seek(page,.98);
  const scene=page.locator(".retrieval-proof-strip"),source=scene.locator(".retrieval-source-identity");
  await source.focus();await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(1);
  await page.emulateMedia({reducedMotion:"reduce"});
  await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(0);
  await expect(page.locator("#product")).toHaveAttribute("data-scroll-story","false");
  await source.press("Enter");await expect(scene.getByRole("status")).toContainText("Citation 1 supports");
  await page.emulateMedia({reducedMotion:"no-preference"});await seek(page,.98);
  await scene.locator('[data-relationship="document"]').focus();await source.focus();
  await expect(scene).toHaveAttribute("data-trace","arrived");
  await expect(scene.locator(".retrieval-provenance-tracer")).toHaveCount(0);
});
