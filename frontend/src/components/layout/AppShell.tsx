import { useRef, useState } from "react";
import { DataLoader } from "../DataLoader";
import { AskAIPanel } from "../panels/AskAIPanel";
import { DocumentsView } from "../documents/DocumentsView";
import { SearchWorkspace } from "../workspaces/SearchWorkspace";
import { TerminalLog } from "../terminal/TerminalLog";
import { VectorLabWorkspace } from "../workspaces/VectorLabWorkspace";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import { useDocuments } from "../../hooks/useDocuments";
import { PrimarySidebar } from "./PrimarySidebar";

export function AppShell() {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const [chatBusy, setChatBusy] = useState(false);
  const chatRef = useRef<HTMLElement>(null);
  const documentsQuery = useDocuments();
  const needsKnowledge = documentsQuery.isSuccess && documentsQuery.data.length === 0;

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
    <div className="h-dvh w-full min-w-0 bg-base text-[--text-primary] font-sans flex flex-col overflow-hidden">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-panel focus:p-3">
        Skip to workspace
      </a>
      <DataLoader />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <PrimarySidebar onNewChat={startNewChat} onSelectConversation={selectConversation} chatBusy={chatBusy} />
        <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
          <main id="workspace" tabIndex={-1} className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden outline-none">
            {/* Keep feature owners mounted so navigation preserves streams and file selections. */}
            <section ref={chatRef} aria-label="Chat workspace" inert={activeView !== "chat"}
              className={`${activeView === "chat" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              <div className="w-full flex-1 min-h-0">
                <AskAIPanel onProcessingChange={setChatBusy} needsKnowledge={needsKnowledge} />
              </div>
            </section>
            <section aria-label="Documents workspace" inert={activeView !== "documents"}
              className={`${activeView === "documents" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0 overflow-y-auto`}>
              <DocumentsView />
            </section>
            <section aria-label="Search workspace" inert={activeView !== "search"}
              className={`${activeView === "search" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              {activeView === "search" && <SearchWorkspace />}
            </section>
            <VectorLabWorkspace active={activeView === "vector-lab"} />
          </main>
          <TerminalLog />
        </div>
      </div>
    </div>
  );
}
