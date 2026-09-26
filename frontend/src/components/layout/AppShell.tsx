import { useRef, useState } from "react";
import { DataLoader } from "../DataLoader";
import { AskAIPanel } from "../panels/AskAIPanel";
import { IngestPanel } from "../panels/IngestPanel";
import { SearchPanel } from "../panels/SearchPanel";
import { TerminalLog } from "../terminal/TerminalLog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { VectorLabWorkspace } from "../workspaces/VectorLabWorkspace";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import { PrimarySidebar } from "./PrimarySidebar";
import { TopNav } from "./TopNav";
import { WorkspaceHeader } from "./WorkspaceHeader";

export function AppShell() {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const [chatBusy, setChatBusy] = useState(false);
  const [confirmNewChat, setConfirmNewChat] = useState(false);
  const chatRef = useRef<HTMLElement>(null);

  const focusComposer = () => {
    requestAnimationFrame(() => chatRef.current?.querySelector("textarea")?.focus());
  };

  const startNewChat = () => {
    if (chatBusy) return;
    const session = useSessionStore.getState();
    session.clearChat();
    session.setAskAiInput("");
    useCanvasStore.getState().setHighlighted([]);
    useCanvasStore.getState().setQueryPoint(null);
    setActiveView("chat");
    focusComposer();
  };

  const requestNewChat = () => {
    if (chatBusy) return;
    setActiveView("chat");
    if (useSessionStore.getState().chatHistory.length > 0) {
      setConfirmNewChat(true);
    } else {
      startNewChat();
    }
  };

  return (
    <div className="h-dvh w-full min-w-0 bg-base text-[#f4f4f4] font-sans flex flex-col overflow-hidden">
      <a href="#workspace" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-panel focus:p-3">
        Skip to workspace
      </a>
      <TopNav />
      <DataLoader />
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
        <PrimarySidebar onNewChat={requestNewChat} chatBusy={chatBusy} />
        <div className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden">
          <WorkspaceHeader />
          <main id="workspace" tabIndex={-1} className="flex flex-1 flex-col min-h-0 min-w-0 overflow-hidden outline-none">
            {/* Keep feature owners mounted so navigation preserves streams and file selections. */}
            <section ref={chatRef} aria-label="Chat workspace" inert={activeView !== "chat"}
              className={`${activeView === "chat" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              <div className="w-full max-w-4xl mx-auto flex-1 min-h-0">
                <AskAIPanel onProcessingChange={setChatBusy} />
              </div>
            </section>
            <section aria-label="Documents workspace" inert={activeView !== "documents"}
              className={`${activeView === "documents" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0 overflow-y-auto`}>
              <div className="w-full max-w-3xl mx-auto flex-1 min-h-[420px] p-2 sm:p-4">
                <IngestPanel />
              </div>
            </section>
            <section aria-label="Search workspace" inert={activeView !== "search"}
              className={`${activeView === "search" ? "flex" : "hidden"} flex-1 flex-col min-h-0 min-w-0`}>
              <div className="w-full max-w-4xl mx-auto flex-1 min-h-0 p-2 sm:p-4">
                {activeView === "search" && <SearchPanel />}
              </div>
            </section>
            <VectorLabWorkspace active={activeView === "vector-lab"} />
          </main>
          <TerminalLog />
        </div>
      </div>
      <ConfirmDialog open={confirmNewChat} onOpenChange={setConfirmNewChat}
        title="Start a new chat?" description="This clears the current chat saved in this browser. Your indexed knowledge will stay available."
        confirmLabel="Start new chat" onConfirm={startNewChat} />
    </div>
  );
}
