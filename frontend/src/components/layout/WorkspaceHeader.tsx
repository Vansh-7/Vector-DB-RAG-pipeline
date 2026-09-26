import { ArrowUpRight } from "lucide-react";
import { useSessionStore, type WorkspaceView } from "../../store/sessionStore";

const WORKSPACES: Record<WorkspaceView, { title: string; description: string }> = {
  chat: { title: "Chat", description: "Ask questions. Explore your knowledge." },
  documents: { title: "Documents", description: "Add knowledge from files or pasted text." },
  search: { title: "Search", description: "Find knowledge by meaning." },
  "vector-lab": { title: "Vector Lab", description: "Explore the custom vector engine." },
};

export function WorkspaceHeader() {
  const activeView = useSessionStore((s) => s.activeView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const { title, description } = WORKSPACES[activeView];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[--border-subtle] px-4 sm:px-6 py-4 shrink-0">
      <div className="min-w-0">
        <h1 className="text-md font-semibold">{title}</h1>
        <p className="text-xs text-[#888] mt-1 truncate">{description}</p>
      </div>
      {(activeView === "chat" || activeView === "search") && (
        <button type="button" onClick={() => openVectorLab("space")}
          className="flex items-center gap-1.5 text-xs text-[#888] hover:text-white shrink-0 rounded p-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888]">
          <span className="hidden sm:inline">View vector space</span><ArrowUpRight className="w-4 h-4" />
          <span className="sr-only sm:hidden">View vector space</span>
        </button>
      )}
    </div>
  );
}
