import { FileText, LogOut, MessageSquare, Network, PanelLeftClose, PanelLeftOpen, Plus, Search, UserRound } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore, type WorkspaceView } from "../../store/sessionStore";
import { Tooltip } from "../ui/Tooltip";
import { RecentConversations } from "./RecentConversations";

const NAVIGATION = [
  { view: "chat", label: "Chat", icon: MessageSquare },
  { view: "documents", label: "Documents", icon: FileText },
  { view: "search", label: "Search", icon: Search },
  { view: "vector-lab", label: "Vector Lab", icon: Network },
] satisfies { view: WorkspaceView; label: string; icon: typeof MessageSquare }[];

export function PrimarySidebar({ onNewChat, onSelectConversation, chatBusy }: { onNewChat: () => void; onSelectConversation: (id: number) => void; chatBusy: boolean }) {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const collapsed = useSessionStore((s) => s.isNavigationCollapsed);
  const setCollapsed = useSessionStore((s) => s.setNavigationCollapsed);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const labelClass = collapsed ? "hidden" : "hidden lg:inline";

  return (
    <aside aria-label="Primary sidebar" className={`${collapsed ? "w-16" : "w-16 lg:w-[224px]"} shrink-0 bg-panel border-r border-[--border-subtle] flex flex-col min-h-0`}>
      <div className="p-3 space-y-3">
        <div className={`hidden lg:flex ${collapsed ? "justify-center" : "justify-between"} items-center h-7`}>
          {!collapsed && <span className="text-2xs text-[#555] uppercase tracking-widest">Workspace</span>}
          <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="p-1.5 rounded text-[#888] hover:bg-hover hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888]">
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>
        <Tooltip content={chatBusy ? "Wait for the current answer to finish" : "New Chat"}>
          <button type="button" onClick={onNewChat} disabled={chatBusy} aria-label="New Chat"
            className="flex items-center justify-center gap-2 w-full h-9 rounded-[4px] border border-[--border-default] bg-elevated text-[#f4f4f4] text-sm font-medium hover:bg-hover hover:border-[--border-strong] active:scale-[0.98] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
            <Plus className="w-4 h-4 shrink-0 text-[--color-info]" /><span className={labelClass}>New Chat</span>
          </button>
        </Tooltip>
      </div>
      <nav aria-label="Primary navigation" className="px-3 space-y-1">
        {NAVIGATION.map(({ view, label, icon: Icon }) => (
          <Tooltip key={view} content={label}>
            <button type="button" aria-label={label} aria-current={activeView === view ? "page" : undefined}
              onClick={() => setActiveView(view)}
              className={`flex items-center gap-3 w-full h-10 px-2 rounded-[4px] border-l-2 text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888] ${activeView === view ? "border-[--color-info] bg-active text-[#f4f4f4]" : "border-transparent text-[#888] hover:bg-hover hover:text-[#f4f4f4]"}`}>
              <Icon className="w-4 h-4 shrink-0" /><span className={labelClass}>{label}</span>
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!collapsed && activeView === "chat" && <div className="hidden lg:block"><RecentConversations chatBusy={chatBusy} onSelect={onSelectConversation} /></div>}
      </div>
      <div className={`m-3 border-t border-[--border-subtle] pt-3 flex items-center min-h-12 ${collapsed ? "justify-center" : "justify-center lg:justify-between"}`}>
        {!collapsed && <div className="hidden lg:flex items-center gap-2 min-w-0">
          <UserRound className="w-4 h-4 text-[#888] shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs text-[#f4f4f4]">Account</p>
            <p className="text-2xs text-[#888] mt-0.5 truncate" title={user?.email}>{user?.email}</p>
          </div>
        </div>}
        <Tooltip content="Sign out">
          <button type="button" onClick={logout} aria-label="Sign out"
            className="p-2 rounded text-[#888] hover:bg-hover hover:text-[#f4f4f4] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888]">
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}
