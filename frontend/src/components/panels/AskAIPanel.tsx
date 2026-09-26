import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { askQuestion } from "../../api/query";
import { conversationKeys, listConversationMessages } from "../../api/conversations";
import { useConversationMessages, useConversations } from "../../hooks/useConversations";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore } from "../../store/sessionStore";
import { useEngineStore } from "../../store/engineStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useTerminalStore } from "../../store/terminalStore";
import { getCurrentTimestamp } from "../../lib/utils";
import type { ChatMessage, RAGSource } from "../../types/rag";
import type { ConversationMessageRecord } from "../../types/conversation";
import { AskAIComposer } from "./AskAIComposer";
import { ChatMessage as ChatMessageView } from "./ChatMessage";
import { AskAIPromptChips } from "./AskAIPromptChips";
import { SourcesInspector } from "./SourcesInspector";

function stripThinking(text: string): string {
  const stripped = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
  const open = stripped.indexOf("<thinking>");
  return open === -1 ? stripped : stripped.slice(0, open);
}

function toChatMessage(message: ConversationMessageRecord): ChatMessage {
  return {
    id: String(message.id),
    role: message.role,
    content: message.content,
    sources: message.sources ?? [],
    timestamp: message.created_at,
  };
}

interface StreamingTurn {
  base: ChatMessage[];
  question: string;
  answer: string;
  sources: RAGSource[];
}

export function AskAIPanel({ onProcessingChange }: { onProcessingChange?: (processing: boolean) => void }) {
  const userId = useAuthStore((s) => s.user?.id);
  const conversationId = useSessionStore((s) => s.activeConversationId);
  const setConversationId = useSessionStore((s) => s.setActiveConversationId);
  const input = useSessionStore((s) => s.askAiInput);
  const setInput = useSessionStore((s) => s.setAskAiInput);
  const topK = useEngineStore((s) => s.topK);
  const setQueryPoint = useCanvasStore((s) => s.setQueryPoint);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const addLog = useTerminalStore((s) => s.addLog);
  const queryClient = useQueryClient();
  const [stream, setStream] = useState<StreamingTurn | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [inspectedSources, setInspectedSources] = useState<RAGSource[] | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeInspector = useCallback((restoreFocus = true) => {
    setInspectedSources(null);
    if (restoreFocus) requestAnimationFrame(() => inspectorTriggerRef.current?.focus());
  }, []);
  const openInspector = useCallback((sources: RAGSource[], trigger: HTMLButtonElement) => {
    inspectorTriggerRef.current = trigger;
    setInspectedSources(sources);
  }, []);
  const isProcessing = stream !== null;
  const messagesQuery = useConversationMessages(conversationId, stream === null);
  const conversationsQuery = useConversations();
  const streamGuard = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousConversationRef = useRef(conversationId);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (previousConversationRef.current !== conversationId && !streamGuard.current) {
      setRequestError(null);
      setInspectedSources(null);
    }
    previousConversationRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => { onProcessingChange?.(isProcessing); }, [isProcessing, onProcessingChange]);

  const serverMessages = messagesQuery.data?.map(toChatMessage) ?? [];
  const messages: ChatMessage[] = stream ? [
    ...stream.base,
    { id: "stream-user", role: "user", content: stream.question, timestamp: "" },
    { id: "stream-assistant", role: "assistant", content: stream.answer, sources: stream.sources, timestamp: "" },
  ] : serverMessages;
  const conversationTitle = conversationsQuery.data?.find((conversation) => conversation.id === conversationId)?.title;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isProcessing ? "smooth" : "instant" });
  }, [conversationId, messages.length, stream?.answer, isProcessing]);

  const handleSubmit = async () => {
    const question = input.trim();
    if (!question || streamGuard.current || (conversationId !== null && (messagesQuery.isPending || messagesQuery.isError))) return;
    streamGuard.current = true;
    onProcessingChange?.(true);
    setInput("");
    setRequestError(null);
    setInspectedSources(null);
    setHighlighted([]);
    setQueryPoint(null);
    setStream({ base: serverMessages, question, answer: "", sources: [] });
    const controller = new AbortController();
    abortRef.current = controller;
    let resolvedId = conversationId;
    let answer = "";

    try {
      await askQuestion({
        question,
        k: topK,
        conversationId,
        signal: controller.signal,
        onConversation: (conversation) => {
          resolvedId = conversation.id;
          if (conversationId === null) setConversationId(conversation.id);
          void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
        },
        onToken: (token) => {
          answer += token;
          setStream((current) => current ? { ...current, answer: stripThinking(answer) } : null);
        },
        onSources: (sources) => {
          setStream((current) => current ? { ...current, sources } : null);
          setHighlighted(sources.map((source) => source.vectorId), Object.fromEntries(sources.map((source) => [source.vectorId, source.score])));
        },
        onQueryPoint: (coords) => setQueryPoint({ x: coords[0], y: coords[1] }),
      });
      if (resolvedId === null) throw new Error("The answer ended without a conversation ID.");
      if (!stripThinking(answer).trim()) throw new Error("The model returned no answer.");
      await queryClient.fetchQuery({ queryKey: conversationKeys.messages(userId, resolvedId), queryFn: () => listConversationMessages(resolvedId!), staleTime: 0 });
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
    } catch (error) {
      if (useAuthStore.getState().user?.id === userId) {
        const stopped = controller.signal.aborted;
        const message = stopped ? "Answer stopped. Your question may be saved in this chat." : error instanceof Error ? error.message : "The answer could not be completed.";
        setRequestError(`${message} Check the conversation before sending again.`);
        addLog({ timestamp: getCurrentTimestamp(), level: stopped ? "INFO" : "ERROR", message: `Ask AI: ${message}` });
        if (resolvedId !== null) {
          try {
            await queryClient.fetchQuery({ queryKey: conversationKeys.messages(userId, resolvedId), queryFn: () => listConversationMessages(resolvedId!), staleTime: 0 });
          } catch { /* The inline retry remains available. */ }
        }
        void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      streamGuard.current = false;
      if (useAuthStore.getState().user?.id === userId) {
        setStream(null);
        onProcessingChange?.(false);
      }
    }
  };

  const loading = conversationId !== null && stream === null && messagesQuery.isPending;
  const failed = conversationId !== null && stream === null && messagesQuery.isError;
  const showEmpty = !loading && !failed && messages.length === 0;

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      {conversationId !== null && <div className="shrink-0 border-b border-[--border-subtle] px-4 sm:px-6 py-3">
        <p className="truncate text-sm font-medium text-[--text-primary]">{conversationTitle ?? "Conversation"}</p>
        <p className="mt-0.5 font-mono text-[10px] text-[--text-tertiary]">Saved conversation</p>
      </div>}
      {requestError && <div role="alert" className="flex items-start gap-2 border-b border-error/20 bg-error/5 px-4 py-3 text-xs text-error"><AlertCircle className="mt-0.5 w-4 h-4 shrink-0" /><span className="min-w-0 break-words">{requestError}</span><button type="button" onClick={() => { setRequestError(null); if (conversationId !== null) void messagesQuery.refetch(); }} className="ml-auto shrink-0 underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error">Dismiss / refresh</button></div>}
      {loading ? <div aria-label="Loading conversation" className="flex flex-1 items-center justify-center gap-2 text-xs text-[--text-secondary]"><Loader2 className="w-4 h-4 animate-spin" /> Loading conversation</div>
        : failed ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center"><p className="text-sm">Conversation could not be loaded.</p><button type="button" onClick={() => void messagesQuery.refetch()} className="flex items-center gap-2 rounded-[4px] border border-[--border-default] px-3 py-2 text-xs hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><RefreshCw className="w-3.5 h-3.5" /> Retry</button></div>
          : showEmpty ? <div className="flex flex-1 flex-col items-center justify-center p-4">
            <img src="/kernspace-logo.png" alt="Kernspace — RAG and Vector Search" className="mb-4 h-auto w-64 sm:w-80 mix-blend-screen" />
            <h2 className="mb-2 text-lg font-medium text-[--text-primary]">Ask a question.</h2>
            <p className="mb-6 max-w-md text-center text-xs leading-relaxed text-[--text-secondary]">Explore the knowledge in your documents. Answers include the sources used.</p>
            <div className="w-full max-w-[520px]"><AskAIComposer input={input} setInput={setInput} onSubmit={handleSubmit} status="READY" isCentered /><AskAIPromptChips onSelect={setInput} /></div>
          </div>
            : <div className="flex min-h-0 flex-1 flex-col">
              <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
                {messages.map((message, index) => <ChatMessageView key={message.id} message={message} isStreaming={stream !== null && index === messages.length - 1 && message.role === "assistant"} onInspectSources={openInspector} />)}
                <div ref={messagesEndRef} className="h-2" />
              </div>
              <div className="shrink-0 border-t border-[--border-subtle] bg-base/90 p-3 sm:p-4"><div className="mx-auto max-w-3xl"><AskAIComposer input={input} setInput={setInput} onSubmit={handleSubmit} onCancel={() => abortRef.current?.abort()} status={stream ? "PROCESSING" : "READY"} isCentered={false} /></div></div>
            </div>}
      {inspectedSources && <SourcesInspector sources={inspectedSources} onClose={closeInspector} />}
    </div>
  );
}
