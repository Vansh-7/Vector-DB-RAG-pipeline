import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { FileText, FlaskConical, MessageSquare, PanelLeft, Plus, Search } from "lucide-react";
import { SIDEBAR_WIDTH, useSessionStore, type WorkspaceView } from "../../store/sessionStore";
import { useCanvasStore } from "../../store/canvasStore";
import { Tooltip } from "../ui/Tooltip";
import { NeuebitBrand } from "../brand/NeuebitBrand";
import { RecentConversations } from "./RecentConversations";
import { AccountMenu } from "./AccountMenu";

const NAVIGATION = [
  { view: "chat", label: "Chat", icon: MessageSquare },
  { view: "documents", label: "Documents", icon: FileText },
  { view: "search", label: "Search", icon: Search },
  { view: "vector-lab", label: "Vector Lab", icon: FlaskConical },
] satisfies { view: WorkspaceView; label: string; icon: typeof MessageSquare }[];

const COLLAPSE_DRAG_DISTANCE = 32;

export function PrimarySidebar({ onNewChat, onSelectConversation, chatBusy }: { onNewChat: () => void; onSelectConversation: (id: number) => void; chatBusy: boolean }) {
  const activeView = useSessionStore((s) => s.activeView);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const collapsed = useSessionStore((s) => s.isNavigationCollapsed);
  const setCollapsed = useSessionStore((s) => s.setNavigationCollapsed);
  const sidebarWidth = useSessionStore((s) => s.sidebarWidth);
  const setSidebarWidth = useSessionStore((s) => s.setSidebarWidth);
  const collapseButtonRef = useRef<HTMLButtonElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const releaseResize = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && resizeRef.current?.hasPointerCapture(drag.pointerId)) {
      resizeRef.current.releasePointerCapture(drag.pointerId);
    }
  }, []);
  const stopResize = useCallback(() => {
    releaseResize();
    setIsResizing(false);
  }, [releaseResize]);
  useEffect(() => {
    window.addEventListener("blur", stopResize);
    return () => {
      window.removeEventListener("blur", stopResize);
      releaseResize();
    };
  }, [releaseResize, stopResize]);
  const [narrowRail, setNarrowRail] = useState(() => window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrowRail(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const iconOnly = collapsed || narrowRail;
  useEffect(() => {
    if (iconOnly) stopResize();
  }, [iconOnly, stopResize]);
  const collapseSidebar = (restoreWidth: number) => {
    setSidebarWidth(restoreWidth);
    setCollapsed(true);
    collapseButtonRef.current?.focus();
  };
  const finishPointerResize = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (event.pointerId !== drag?.pointerId) return;
    // Reaching the minimum only narrows the sidebar. Pull farther and release to collapse.
    const shouldCollapse = event.type === "pointerup"
      && drag.startWidth + event.clientX - drag.startX <= SIDEBAR_WIDTH.min - COLLAPSE_DRAG_DISTANCE;
    stopResize();
    if (shouldCollapse) collapseSidebar(drag.startWidth);
  };

  return (
    <aside aria-label="Primary sidebar" data-collapsed={collapsed} data-resizing={isResizing} style={{ "--sidebar-expanded-width": `${sidebarWidth}px` } as CSSProperties} className="primary-sidebar shrink-0 bg-panel border-r border-[--border-subtle] flex flex-col min-h-0">
      <div className="sidebar-header">
        <div className="sidebar-brand-row">
          <div className="flex items-center gap-2" aria-label="NeueBit">
            <NeuebitBrand wordmarkClassName="sidebar-label" />
          </div>
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <button ref={collapseButtonRef} type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
              aria-expanded={!collapsed} className="sidebar-control sidebar-collapse">
              <PanelLeft className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
        <Tooltip content={chatBusy ? "Wait for the current answer to finish" : "New chat"} enabled={iconOnly}>
          <button type="button" onClick={onNewChat} disabled={chatBusy} aria-label="New chat"
            className="sidebar-control sidebar-new-chat">
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="sidebar-label">New chat</span>
          </button>
        </Tooltip>
      </div>
      <nav aria-label="Primary navigation" className="sidebar-navigation">
        {NAVIGATION.map(({ view, label, icon: Icon }) => (
          <Tooltip key={view} content={label} enabled={iconOnly}>
            <button type="button" aria-label={label} aria-current={activeView === view ? "page" : undefined}
              onClick={() => {
                if (view === "vector-lab" && activeView !== "vector-lab") {
                  useCanvasStore.getState().clearAll();
                }
                setActiveView(view);
              }}
              className="sidebar-control sidebar-nav-control">
              <Icon className="w-4 h-4 shrink-0" aria-hidden="true" /><span className="sidebar-label">{label}</span>
            </button>
          </Tooltip>
        ))}
      </nav>
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">
        {!collapsed && <div className="hidden md:block"><RecentConversations chatBusy={chatBusy} onSelect={onSelectConversation} /></div>}
      </div>
      <div className="sidebar-footer">
        <AccountMenu />
      </div>
      {!iconOnly && <div ref={resizeRef} role="separator" aria-orientation="vertical" aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_WIDTH.min} aria-valuemax={SIDEBAR_WIDTH.max} aria-valuenow={sidebarWidth}
        aria-valuetext={`${sidebarWidth} pixels`} tabIndex={0} className="sidebar-resizer" data-resizing={isResizing}
        onPointerDown={(event) => {
          if (event.button !== 0 || !event.isPrimary) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          const startWidth = Math.round(event.currentTarget.parentElement!.getBoundingClientRect().width);
          dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startWidth };
          setSidebarWidth(startWidth);
          setIsResizing(true);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (drag?.pointerId === event.pointerId) setSidebarWidth(drag.startWidth + event.clientX - drag.startX);
        }}
        onPointerUp={finishPointerResize} onPointerCancel={finishPointerResize} onLostPointerCapture={stopResize}
        onDoubleClick={() => setSidebarWidth(SIDEBAR_WIDTH.default)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const increment = event.shiftKey ? 32 : 8;
          if (event.key === "ArrowLeft" && sidebarWidth === SIDEBAR_WIDTH.min) {
            if (!event.repeat) collapseSidebar(sidebarWidth);
          }
          else setSidebarWidth(sidebarWidth + (event.key === "ArrowRight" ? increment : -increment));
        }} />}
    </aside>
  );
}
