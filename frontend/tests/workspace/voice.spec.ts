import type { Page } from "@playwright/test";
import { test, expect, seedSession } from "../entry/fixtures";
import { knowledgeApi } from "../theme/fixtures";

async function mockSpeech(page: Page, prefixed = false) {
  await page.addInitScript((usePrefix) => {
    const instances: any[] = [];
    const control = { instances, aborted: 0, queued: null as any };
    class Recognition {
      onresult: any; onerror: any; onend: any;
      continuous = false; interimResults = false; lang = "";
      constructor() { instances.push(this); }
      start() { control.queued = this.onresult; }
      stop() { this.onend?.(); }
      abort() { control.aborted++; }
    }
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: usePrefix ? undefined : Recognition });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: usePrefix ? Recognition : undefined });
    (window as any).__speech = control;
  }, prefixed);
  await seedSession(page); await knowledgeApi(page); await page.goto("/app");
}

async function result(page: Page, text: string, queued = false) {
  await page.evaluate(({ text, queued }) => {
    const control = (window as any).__speech;
    const recognition = control.instances.at(-1);
    const event = { resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: true })] };
    (queued ? control.queued : recognition.onresult)?.(event);
    if (!queued) recognition.onend?.();
  }, { text, queued });
}

for (const prefixed of [false, true]) {
  test(`${prefixed ? "webkit" : "standard"} speech appends final transcripts to the latest typed draft and supports two dictations`, async ({ page }) => {
    await mockSpeech(page, prefixed);
    const input = page.getByRole("textbox", { name: "Ask a question about your knowledge" });
    await input.fill("Explain");
    await page.getByRole("button", { name: "Start voice input", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop voice input" })).toBeVisible();
    await input.fill("Explain clearly");
    await result(page, "HNSW retrieval");
    await expect(input).toHaveValue("Explain clearly HNSW retrieval");
    await page.getByRole("button", { name: "Start voice input", exact: true }).click();
    await result(page, "with examples");
    await expect(input).toHaveValue("Explain clearly HNSW retrieval with examples");
    expect(await page.evaluate(() => {
      const rec = (window as any).__speech.instances.at(-1);
      return { continuous: rec.continuous, interim: rec.interimResults, lang: rec.lang };
    })).toEqual({ continuous: false, interim: false, lang: "en-US" });
  });
}

test("stop, no-result, permission denial and recognition errors retain the draft and reset recording", async ({ page }) => {
  await mockSpeech(page);
  const input = page.getByRole("textbox", { name: "Ask a question about your knowledge" });
  await input.fill("Keep this draft");
  await page.getByRole("button", { name: "Start voice input", exact: true }).click();
  await page.getByRole("button", { name: "Stop voice input" }).click();
  await expect(page.getByRole("button", { name: "Start voice input", exact: true })).toBeVisible();
  for (const error of ["not-allowed", "network", "no-speech"]) {
    await page.getByRole("button", { name: "Start voice input", exact: true }).click();
    await page.evaluate((error) => (window as any).__speech.instances.at(-1).onerror?.({ error }), error);
    await expect(page.getByRole("button", { name: "Start voice input", exact: true })).toBeVisible();
    await expect(input).toHaveValue("Keep this draft");
  }
  await page.getByRole("button", { name: "Start voice input", exact: true }).click();
  await result(page, "   ");
  await expect(input).toHaveValue("Keep this draft");
});

test("unsupported browsers hide the microphone", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitSpeechRecognition", { configurable: true, value: undefined });
  });
  await seedSession(page); await knowledgeApi(page); await page.goto("/app");
  await expect(page.getByRole("textbox", { name: "Ask a question about your knowledge" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start voice input", exact: true })).toHaveCount(0);
});

test("an unmounted composer aborts recognition and ignores its queued transcript", async ({ page }) => {
  await mockSpeech(page);
  const input = page.getByRole("textbox", { name: "Ask a question about your knowledge" });
  await input.fill("Old draft");
  await page.getByRole("button", { name: "Start voice input", exact: true }).click();
  await page.getByRole("complementary", { name: "Primary sidebar" }).getByRole("button", { name: "How does retrieval work?", exact: true }).click();
  await expect(page.getByRole("button", { name: "2 sources" })).toBeVisible();
  await input.fill("New draft");
  await result(page, "late transcript", true);
  await expect(input).toHaveValue("New draft");
  expect(await page.evaluate(() => (window as any).__speech.aborted)).toBeGreaterThan(0);
});
