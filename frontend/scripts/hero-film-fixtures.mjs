// Capture-only responses. The landing page imports neither these helpers nor the app.
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";

export async function filmFixtures(page, { knowledgeApi, reply, demoDocuments, demoChunks, demoPrompts }) {
  await knowledgeApi(page);
  const prompt = demoPrompts[0];
  const date = "2026-10-05T10:00:00Z";
  const conversations = demoPrompts.map((item, index) => ({ id: 7 + index, title: item.question, created_at: date, updated_at: date }));
  const sources = prompt.sourceIds.map((id, index) => {
    const chunk = demoChunks.find(item => item.id === id);
    return { vectorId: id, category: chunk.category, snippet: chunk.text, score: .9 - index * .1,
      documentId: demoDocuments.findIndex(item => item.id === chunk.documentId) + 1 };
  });
  const state = { readyAt: Infinity, messages: [], streamChunks: 0, writes: [], documentStates: [], streamComplete: false };
  const server = createServer(async (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    response.setHeader("Access-Control-Allow-Headers", "authorization,content-type");
    response.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    if (request.method !== "POST" || request.url !== "/ask") { response.writeHead(404); response.end(); return; }
    let body = "";
    for await (const chunk of request) body += chunk;
    const data = JSON.parse(body);
    state.writes.push({ path: "/ask", body: data });
    if (data.question !== prompt.question || data.conversation_id !== 7) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ detail: "Capture question or conversation does not match its authored source." }));
      return;
    }
    response.writeHead(200, { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" });
    response.flushHeaders();
    const emit = (type, value) => response.write(JSON.stringify({ type, data: value }) + "\n");
    emit("conversation", conversations[0]);
    emit("query_2d", [40, 50]);
    // Separate network writes exercise the app's real streaming consumer.
    for (const token of prompt.answer.match(/\S+\s*/g)) {
      if (response.destroyed) return;
      emit("token", token); state.streamChunks++;
      await delay(32);
    }
    emit("sources", sources);
    state.messages = [
      { id: 1, conversation_id: 7, role: "user", content: prompt.question, sources: null, created_at: date },
      { id: 2, conversation_id: 7, role: "assistant", content: prompt.answer, sources, created_at: date },
    ];
    state.streamComplete = true;
    response.end();
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const streamOrigin = `http://127.0.0.1:${server.address().port}`;
  await page.route("**/api/v1/ask", route => route.continue({ url: `${streamOrigin}/ask` }));
  await page.route("**/api/v1/documents", route => {
    const ready = Date.now() >= state.readyAt;
    state.documentStates.push(ready ? "ready" : "processing");
    return reply(route, demoDocuments.map((document, index) => ({ id: index + 1, name: document.name,
      category: "TECH", source_type: "file", status: index === 2 && !ready ? "processing" : "ready",
      chunk_count: index === 2 && !ready ? 0 : demoChunks.filter(chunk => chunk.documentId === document.id).length,
      created_at: date })));
  });
  await page.route("**/api/v1/conversations", route => reply(route, conversations));
  await page.route("**/api/v1/conversations/7/messages", route => reply(route, state.messages));
  await page.route("**/api/v1/search/text", async route => {
    const body = route.request().postDataJSON();
    state.writes.push({ path: "/search/text", body });
    await delay(180);
    // A source handoff requests only the originating question's projection.
    // Empty fresh results prove the app retains its original RAG citation.
    await reply(route, { results: body.text === prompt.question ? [] : sources.map(source => ({ id: source.vectorId, distance: .1,
      metadata: source.snippet, category: source.category, document_id: source.documentId })),
      query_vector: [1, 0, 0], query_2d: body.text === prompt.question ? [40, 50] : [38, 48] });
  });
  return { state, prompt, sources, close: () => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }) };
}
