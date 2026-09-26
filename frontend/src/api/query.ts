import { apiRequest, ApiError } from "./client";
import { useTerminalStore } from "../store/terminalStore";
import { getCurrentTimestamp } from "../lib/utils";
import type { RAGSource } from "../types";

interface AskQuestionOptions {
  question: string;
  k: number;
  conversationId: number | null;
  signal: AbortSignal;
  onConversation: (conversation: { id: number; title: string }) => void;
  onToken: (token: string) => void;
  onSources: (sources: RAGSource[]) => void;
  onQueryPoint: (coords: [number, number]) => void;
}

export async function askQuestion(options: AskQuestionOptions): Promise<void> {
  const { question, k, conversationId, signal, onConversation, onToken, onSources, onQueryPoint } = options;
  const addLog = useTerminalStore.getState().addLog;
  addLog({ timestamp: getCurrentTimestamp(), level: "INFO", message: `Streaming RAG Query: "${question}"` });

  const response = await apiRequest("/ask", {
    method: "POST",
    body: JSON.stringify({ question, k, conversation_id: conversationId }),
    signal,
  });
  signal.throwIfAborted();
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const detail = typeof body?.detail === "string" ? body.detail : `Request failed (${response.status}).`;
    throw new ApiError(response.status, detail);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("The answer stream is unavailable.");
  const decoder = new TextDecoder();
  let buffer = "";
  let finished = false;
  const abortReader = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortReader, { once: true });

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    let event: { type?: string; data?: unknown };
    try {
      event = JSON.parse(line);
    } catch {
      throw new Error("The answer stream contained an invalid event.");
    }
    if (event.type === "conversation") {
      const data = event.data as { id?: number; title?: string } | undefined;
      if (typeof data?.id === "number") onConversation({ id: data.id, title: data.title ?? "New chat" });
    } else if (event.type === "sources" && Array.isArray(event.data)) {
      onSources(event.data as RAGSource[]);
    } else if (event.type === "query_2d" && Array.isArray(event.data) && event.data.length >= 2) {
      onQueryPoint([Number(event.data[0]), Number(event.data[1])]);
    } else if (event.type === "token" && typeof event.data === "string") {
      onToken(event.data);
    } else if (event.type === "error") {
      throw new Error(typeof event.data === "string" ? event.data : "Answer generation failed.");
    }
  };

  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handleLine(line);
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
    signal.throwIfAborted();
    finished = true;
    addLog({ timestamp: getCurrentTimestamp(), level: "SUCCESS", message: "RAG Stream complete." });
  } finally {
    signal.removeEventListener("abort", abortReader);
    if (!finished) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
