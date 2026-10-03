import type { Page } from "@playwright/test";
import { demoChunks, demoDocuments, demoPrompts } from "../../src/components/marketing/demo/demoContent";
import { reply, stubApi } from "../entry/fixtures";

export async function appearance(page: Page, os: "light" | "dark", stored?: "light" | "dark") {
  await page.emulateMedia({ colorScheme: os });
  if (stored) await page.addInitScript((value) => {
    if (!sessionStorage.getItem("appearance-fixture-seeded")) {
      localStorage.setItem("neuebit-theme", value);
      sessionStorage.setItem("appearance-fixture-seeded", "true");
    }
  }, stored);
}

export async function knowledgeApi(page: Page) {
  const date = "2026-10-01T10:00:00Z";
  const sources = demoPrompts[0].sourceIds.map((id, index) => {
    const chunk = demoChunks.find((item) => item.id === id)!;
    return { vectorId: id, category: chunk.category, snippet: chunk.text, score: .9 - index * .1,
      documentId: demoDocuments.findIndex((document) => document.id === chunk.documentId) + 1 };
  });
  const conversation = { id: 7, title: "How does retrieval work?", created_at: date, updated_at: date };
  let messages = [
    { id: 1, conversation_id: 7, role: "user", content: demoPrompts[0].question, sources: null, created_at: date },
    { id: 2, conversation_id: 7, role: "assistant", content: demoPrompts[0].answer, sources, created_at: date },
  ];
  const writes: { path: string; body: unknown; authorization: string | undefined }[] = [];
  const api = await stubApi(page, {
    "/documents": (route) => reply(route, demoDocuments.map((document, index) => ({ id: index + 1, name: document.name,
      category: "TECH", source_type: "file", status: "ready", chunk_count: demoChunks.filter((chunk) => chunk.documentId === document.id).length, created_at: date }))),
    "/status": (route) => reply(route, { engine: "hnsw", metric: "cosine", total_docs: demoChunks.length }),
    "/vectors/sample": (route) => reply(route, { count: demoChunks.length, vectors: demoChunks.map((chunk) => ({
      id: chunk.id, x: chunk.position[0], y: chunk.position[1], category: chunk.category, payload: chunk.text,
    })) }),
    "/conversations": (route) => reply(route, [conversation]),
    "/conversations/7/messages": (route) => reply(route, messages),
    "/ask": async (route) => {
      const request = route.request();
      const body = request.postDataJSON();
      writes.push({ path: "/ask", body, authorization: request.headers()["authorization"] });
      const content = demoPrompts[1].answer;
      messages = [...messages,
        { id: 3, conversation_id: 7, role: "user", content: body.question, sources: null, created_at: date },
        { id: 4, conversation_id: 7, role: "assistant", content, sources, created_at: date }];
      await route.fulfill({ status: 200, contentType: "application/x-ndjson", headers: { "access-control-allow-origin": "*" },
        body: [{ type: "conversation", data: conversation }, { type: "sources", data: sources }, { type: "token", data: content }]
          .map((event) => JSON.stringify(event)).join("\n") + "\n" });
    },
    "/search/text": async (route) => {
      const request = route.request();
      writes.push({ path: "/search/text", body: request.postDataJSON(), authorization: request.headers()["authorization"] });
      await reply(route, { results: sources.map((source) => ({ id: source.vectorId, distance: .1, metadata: source.snippet,
        category: source.category, document_id: source.documentId })), query_vector: [1, 0, 0], query_2d: [40, 50] });
    },
  });
  return { ...api, writes };
}
