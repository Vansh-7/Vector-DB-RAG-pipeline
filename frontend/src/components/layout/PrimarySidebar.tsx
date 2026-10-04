import { FileText, FlaskConical, LogOut, MessageSquare, PanelLeft, Plus, Search } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore, type WorkspaceView } from "../../store/sessionStore";
import { Tooltip } from "../ui/Tooltip";
import { BrandMark } from "../ui/BrandMark";
import { RecentConversations } from "./RecentConversations";
import { ThemeToggle } from "../theme/ThemeToggle";

const NAVIGATION = [
  { view: "chat", label: "Chat", icon: MessageSquare },
  { view: "documents", label: "Documents", icon: FileText },
  { view: "search", label: "Search", icon: Search },
  { view: "vector-lab", label: "Vector Lab", icon: FlaskConical },
] satisfies { view: WorkspaceView; label: string; icon: typeof MessageSquare }[];

export function PrimarySidebar({ onNewChat, onSelectConversation, chatBusy }: { onNewChat: () => void; onSelectConversation: (id: number) => void; chatBusy: boolean }) {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const collapsed = useSessionStore((s) => s.isNavigationCollapsed);
  const setCollapsed = useSessionStore((s) => s.setNavigationCollapsed);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const labelClass = collapsed ? "hidden" : "hidden md:inline";

  return (
    <aside aria-label="Primary sidebar" className={`${collapsed ? "w-16" : "w-16 md:w-[232px]"} shrink-0 bg-panel border-r border-[--border-subtle] flex flex-col min-h-0`}>
      <div className="px-3 pt-4 pb-3 space-y-4">
        <div className={`flex ${collapsed ? "flex-col gap-2" : "justify-center md:justify-between"} items-center min-h-8`}>
          <div className="flex items-center gap-2" aria-label="Neuebit">
            <BrandMark />
            <span className={`${labelClass} text-body font-semibold tracking-[-0.02em]`}>Neuebit</span>
          </div>
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed} className="icon-button hidden md:inline-flex !h-7 !w-7 text-[--text-tertiary]">
              <PanelLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
        <Tooltip content={chatBusy ? "Wait for the current answer to finish" : "New chat"}>
          <button type="button" onClick={onNewChat} disabled={chatBusy} aria-label="New chat"
            className="flex items-center justify-center gap-2 w-full h-[34px] rounded-md border border-[--border-default] text-[--text-primary] text-sm font-medium hover:bg-hover hover:border-[--border-strong] transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
            <Plus className="w-4 h-4 shrink-0" /><span className={labelClass}>New chat</span>
          </button>
        </Tooltip>
      </div>
      <nav aria-label="Primary navigation" className="px-3 space-y-1">
        {NAVIGATION.map(({ view, label, icon: Icon }) => (
          <Tooltip key={view} content={label}>
            <button type="button" aria-label={label} aria-current={activeView === view ? "page" : undefined}
              onClick={() => setActiveView(view)}
              className={`flex items-center gap-2.5 w-full h-8 px-3 rounded text-sm text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] ${activeView === view ? "bg-elevated font-medium text-[--text-primary]" : "text-[--text-tertiary] hover:bg-hover hover:text-[--text-primary]"}`}>
              <Icon className="w-4 h-4 shrink-0" /><span className={labelClass}>{label}</span>
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!collapsed && <div className="hidden md:block"><RecentConversations chatBusy={chatBusy} onSelect={onSelectConversation} /></div>}
      </div>
      <div className={`m-3 flex items-center gap-2 min-h-12 ${collapsed ? "flex-col" : "justify-center md:justify-between"}`}>
        <div className={`${collapsed ? "flex" : "hidden md:flex"} items-center gap-2 min-w-0`}>
          <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-elevated text-xs font-medium text-[--text-secondary]">{user?.email.charAt(0).toUpperCase()}</span>
          {!collapsed && <p className="text-xs text-[--text-secondary] truncate" title={user?.email}>{user?.email}</p>}
        </div>
        <div className={`flex shrink-0 flex-col items-center${collapsed ? "" : " md:flex-row"}`}>
        <ThemeToggle />
        <Tooltip content="Sign out">
          <button type="button" onClick={logout} aria-label="Sign out"
            className="icon-button">
            <LogOut className="w-4 h-4" aria-hidden="true" />
          </button>
        </Tooltip>
        </div>
      </div>
    </aside>
  );
}
