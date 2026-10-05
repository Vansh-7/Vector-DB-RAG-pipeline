import { useRef, useState } from "react";
import { DataLoader } from "../DataLoader";
import { AskAIPanel } from "../panels/AskAIPanel";
import { DocumentsView } from "../documents/DocumentsView";
import { SearchWorkspace } from "../workspaces/SearchWorkspace";
import { TerminalLog } from "../terminal/TerminalLog";
import { VectorLabWorkspace } from "../workspaces/VectorLabWorkspace";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import { PrimarySidebar } from "./PrimarySidebar";
import { AddDocumentPane } from "../documents/AddDocumentPane";
import type { IngestResponse } from "../../types/ingest";
import type { WorkspaceView } from "../../store/sessionStore";

export function AppShell() {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const [chatBusy, setChatBusy] = useState(false);
  const [documentPaneView, setDocumentPaneView] = useState<WorkspaceView | null>(null);
  const [ingestBusy, setIngestBusy] = useState(false);
  const [added, setAdded] = useState<IngestResponse | null>(null);
  const chatRef = useRef<HTMLElement>(null);
  const documentPaneOpen = documentPaneView === activeView;
  const openDocumentPane = (mode?: "file" | "manual") => {
    if (mode && !ingestBusy) useSessionStore.getState().setIngestMode(mode);
    setAdded(null);
    setDocumentPaneView(activeView);
  };

  const focusComposer = () => {
    requestAnimationFrame(() => chatRef.current?.querySelector("textarea")?.focus());
  };

  const startNewChat = () => {
    if (chatBusy) return;
    const session = useSessionStore.getState();
    session.setActiveConversationId(null);
    session.setAskAiInput("");
    useCanvasStore.getState().setHighlighted([]);
    useCanvasStore.getState().setQueryPoint(null);
    setActiveView("chat");
    focusComposer();
  };

  const selectConversation = (id: number) => {
    if (chatBusy) return;
    const session = useSessionStore.getState();
    session.setActiveConversationId(id);
    session.setAskAiInput("");
    useCanvasStore.getState().setHighlighted([]);
    useCanvasStore.getState().setQueryPoint(null);
    setActiveView("chat");
  };

  return (
    <div className="authenticated-app h-dvh w-full min-w-0 bg-base text-[--text-primary] font-sans flex flex-col overflow-hidden">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-panel focus:p-3">
        Skip to workspace
      </a>
      <DataLoader />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <PrimarySidebar onNewChat={startNewChat} onSelectConversation={selectConversation} chatBusy={chatBusy} />
        <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
          <main id="workspace" tabIndex={-1} className="relative flex flex-1 min-h-0 min-w-0 overflow-hidden outline-none">
          <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
            {added && activeView === "chat" && <div role="status" className="flex items-center justify-between gap-3 border-b border-[--border-subtle] px-5 py-2.5 text-xs text-[--text-secondary]">
              <span>{added.status === "ready" ? `Document ready · ${added.chunk_count} ${added.chunk_count === 1 ? "chunk" : "chunks"} indexed.` : "Document added. Processing is in progress."}</span>
              <button type="button" onClick={() => setAdded(null)} className="rounded underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">Dismiss</button>
            </div>}
            {/* Keep feature owners mounted so navigation preserves streams and file selections. */}
            <section ref={chatRef} aria-label="Chat workspace" inert={activeView !== "chat"}
              className={`${activeView === "chat" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              <div className="w-full flex-1 min-h-0">
                <AskAIPanel onProcessingChange={setChatBusy} active={activeView === "chat"}
                  documentPaneOpen={documentPaneOpen} onAddDocument={() => openDocumentPane("file")} />
              </div>
            </section>
            <section aria-label="Documents workspace" inert={activeView !== "documents"}
              className={`${activeView === "documents" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0 overflow-y-auto`}>
              <DocumentsView onAddDocument={openDocumentPane} added={added} onClearAdded={() => setAdded(null)} />
            </section>
            <section aria-label="Search workspace" inert={activeView !== "search"}
              className={`${activeView === "search" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              {activeView === "search" && <SearchWorkspace />}
            </section>
            <VectorLabWorkspace active={activeView === "vector-lab"} />
          </div>
          <AddDocumentPane open={documentPaneOpen} onClose={() => { if (!ingestBusy) setDocumentPaneView(null); }}
            processing={ingestBusy} onProcessingChange={setIngestBusy} onSuccess={(result) => {
              setIngestBusy(false);
              setDocumentPaneView(null);
              setAdded(result);
            }} />
          </main>
          <TerminalLog />
        </div>
      </div>
    </div>
  );
}
