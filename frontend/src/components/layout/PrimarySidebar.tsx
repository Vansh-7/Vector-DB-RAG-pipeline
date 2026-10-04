import { FileText, FlaskConical, MessageSquare, PanelLeft, Plus, Search } from "lucide-react";
import { useSessionStore, type WorkspaceView } from "../../store/sessionStore";
import { Tooltip } from "../ui/Tooltip";
import { BrandMark } from "../ui/BrandMark";
import { RecentConversations } from "./RecentConversations";
import { AccountMenu } from "./AccountMenu";

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

  return (
    <aside aria-label="Primary sidebar" data-collapsed={collapsed} className="primary-sidebar shrink-0 bg-panel border-r border-[--border-subtle] flex flex-col min-h-0">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="flex items-center gap-2" aria-label="Neuebit">
            <BrandMark />
            <span className="sidebar-label text-body font-semibold tracking-[-0.02em]">Neuebit</span>
          </div>
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed} className="sidebar-control sidebar-collapse">
              <PanelLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
        <Tooltip content={chatBusy ? "Wait for the current answer to finish" : "New chat"}>
          <button type="button" onClick={onNewChat} disabled={chatBusy} aria-label="New chat"
            className="sidebar-control sidebar-new-chat">
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="sidebar-label">New chat</span>
          </button>
        </Tooltip>
      </div>
      <nav aria-label="Primary navigation" className="sidebar-navigation">
        {NAVIGATION.map(({ view, label, icon: Icon }) => (
          <Tooltip key={view} content={label}>
            <button type="button" aria-label={label} aria-current={activeView === view ? "page" : undefined}
              onClick={() => setActiveView(view)}
              className="sidebar-control sidebar-nav-control">
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="sidebar-label">{label}</span>
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!collapsed && <div className="hidden md:block"><RecentConversations chatBusy={chatBusy} onSelect={onSelectConversation} /></div>}
      </div>
      <div className="sidebar-footer">
        <AccountMenu />
      </div>
    </aside>
  );
}
