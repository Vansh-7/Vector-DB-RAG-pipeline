import { test, expect, stubApi } from '../entry/fixtures';
import { appearance } from '../theme/fixtures';

const phrases = ['Ask your documents.', 'Search by meaning.', 'Trace every answer.', 'Explore the vector engine.'];
const capabilities = ['chat', 'search', 'documents', 'vectors'];

for (const theme of ['light','dark'] as const) for (const width of [1440,390]) {
  test(`${theme} ${width}px dynamic H1 keeps one centered composition and fixed geometry`, async ({page}) => {
    await appearance(page,theme,theme);
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width,height:1100});
    const {calls} = await stubApi(page); await page.goto('/');
    await page.evaluate(()=>document.fonts.ready);
    const title=page.locator('.marketing-title'), active=title.locator('.hero-headline-phrase[data-active="true"]');
    await expect(title).toHaveCSS('transform','none');
    await expect(page.locator('[data-hero-part="preview"]')).toHaveCSS('transform','none');
    await expect(page.locator('.hero-semantic')).toHaveCount(0);
    await expect(title.locator(':scope > span').first()).toHaveText('Your knowledge.');
    await expect(title.locator('.hero-headline-context, .hero-headline-line')).toHaveCount(0);
    await expect(title.locator(':scope > span')).toHaveCount(2);
    await expect(title.locator('.hero-headline-label')).toHaveText(phrases);
    await expect(title).not.toContainText('in context.');
    await expect(page.locator('.marketing-lead')).toHaveText('An AI workspace for what you know. Find the right context and trace every answer back to its source.');
    const geometry=()=>page.locator('.marketing-hero').evaluate(hero=>
      ['.marketing-title','.hero-headline-slot','.marketing-lead','.marketing-actions','.hero-product'].map(selector=>{
        const el=hero.querySelector(selector)!; const {x,y,width,height}=el.getBoundingClientRect();
        return {x,y,width,height};
      }));
    const initial=await geometry();
    const pillWidths: Record<string, number> = {};
    for (const box of initial) expect(box.x+box.width/2).toBeCloseTo(width/2,0);
    for (const phrase of phrases) {
      await expect(active).toHaveText(phrase,{timeout:4000});
      await expect(active).toHaveCSS('opacity','1'); await expect(active).toHaveCSS('transform','none');
      await expect(title).toHaveAccessibleName(`Your knowledge. ${phrase}`);
      await expect(active).toHaveAttribute('aria-hidden', 'false');
      await expect(active).toHaveAttribute('data-capability', capabilities[phrases.indexOf(phrase)]);
      await expect(title.locator('.hero-headline-phrase[aria-hidden="true"]')).toHaveCount(3);
      const pill = (await active.boundingBox())!;
      expect(pill.x + pill.width / 2).toBeCloseTo(width / 2, 0);
      expect(await active.evaluate(el => {
        const label = el.querySelector('.hero-headline-label')!.getBoundingClientRect();
        const dot = el.querySelector('.hero-headline-dot')!.getBoundingClientRect();
        return Math.abs(label.y + label.height / 2 - dot.y - dot.height / 2);
      })).toBeLessThan(1);
      pillWidths[phrase] = (await active.boundingBox())!.width;
      const current=await geometry();
      for (let i=0;i<initial.length;i++) for (const key of ['x','y','width','height'] as const) expect(Math.abs(current[i][key]-initial[i][key])).toBeLessThan(.5);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    if (width >= 1280) {
      expect(pillWidths[phrases[0]]).toBeLessThan(pillWidths[phrases[3]]);
      expect(pillWidths[phrases[2]]).toBeLessThan(pillWidths[phrases[3]]);
      // Both headline blocks occupy one text row on desktop.
      const label = active.locator('.hero-headline-label');
      expect((await label.boundingBox())!.height).toBeLessThanOrEqual(await label.evaluate(el => parseFloat(getComputedStyle(el).lineHeight)) + 1);
    }
    const ratio=await title.evaluate(el=>parseFloat(getComputedStyle(el.querySelector('.hero-headline-highlight')!).fontSize)/parseFloat(getComputedStyle(el).fontSize));
    expect(ratio).toBeGreaterThanOrEqual(.7); expect(ratio).toBeLessThanOrEqual(.75);
    expect(calls).toEqual([]);
  });
}

for (const theme of ['light','dark'] as const) test(`${theme} headline and controls fit narrow widths and enlarged text`, async ({page})=>{
  await appearance(page,theme,theme); await page.emulateMedia({reducedMotion:'reduce'}); await stubApi(page); await page.goto('/');
  for (const width of [320,375,390,430,768,1024,1280,1440,1920]) {
    await page.setViewportSize({width,height:1100});
    for (const size of ['100%','200%']) {
      await page.evaluate(size=>document.documentElement.style.fontSize=size,size);
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),{message:`${width}/${size}`}).toBe(true);
      const title=await page.locator('.marketing-title').boundingBox(), highlight=await page.locator('.hero-headline-highlight[data-active="true"]').boundingBox();
      expect(highlight!.x).toBeGreaterThanOrEqual(title!.x-.5); expect(highlight!.x+highlight!.width).toBeLessThanOrEqual(title!.x+title!.width+.5);
      expect(await page.locator('.hero-headline-highlight[data-active="true"]').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
      await expect(page.locator('.marketing-title')).toHaveAccessibleName('Your knowledge. Ask your documents.');
      // Inactive grid items reserve space too; every complete statement must fit.
      for (const phrase of await page.locator('.hero-headline-phrase').all()) {
        expect(await phrase.evaluate(el => {
          const label = el.querySelector('.hero-headline-label')!;
          return el.scrollWidth <= el.clientWidth + 1 && label.scrollWidth <= label.clientWidth + 1;
        })).toBe(true);
      }
      for (const button of await page.locator('.marketing-hero .marketing-actions a').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.evaluate(()=>document.documentElement.style.fontSize='100%');
  }
});

test('headline cycling suspends offscreen and hidden; reduced motion has only the complete initial statement',async ({page})=>{
  await page.emulateMedia({reducedMotion:'no-preference'}); await stubApi(page); await page.goto('/');
  const active=page.locator('.hero-headline-phrase[data-active="true"]');
  await expect(active).toHaveText(phrases[1],{timeout:5000});
  await page.locator('#vector-lab').scrollIntoViewIfNeeded(); await page.waitForTimeout(3300); await expect(active).toHaveText(phrases[1]);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));scrollTo(0,0);});
  await page.waitForTimeout(3300); await expect(active).toHaveText(phrases[1]);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>false});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(active).toHaveText(phrases[2],{timeout:4000});
  await page.emulateMedia({reducedMotion:'reduce'}); await expect(active).toHaveText(phrases[0]);
  await page.waitForTimeout(3300); await expect(active).toHaveText(phrases[0]); await expect(active).toHaveCSS('transform','none');
});
