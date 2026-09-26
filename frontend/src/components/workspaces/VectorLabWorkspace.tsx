import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Network, PanelRightOpen, RefreshCw, Settings2, Terminal, Wrench } from "lucide-react";
import { getStatus } from "../../api/status";
import { getVectorSample } from "../../api/vectors";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore, type LabView } from "../../store/sessionStore";
import { VectorInspector } from "../canvas/VectorInspector";
import { VectorSpaceCanvas } from "../canvas/VectorSpaceCanvas";
import { BenchmarksPanel } from "../panels/BenchmarksPanel";
import { EnginePanel } from "../panels/EnginePanel";
import { MaintenancePanel } from "../panels/MaintenancePanel";

const SECTIONS = [
  { view: "space", label: "Vector Space", icon: Network },
  { view: "engine", label: "Engine", icon: Settings2 },
  { view: "benchmarks", label: "Benchmarks", icon: Activity },
  { view: "maintenance", label: "Maintenance", icon: Wrench },
] satisfies { view: LabView; label: string; icon: typeof Network }[];

export function VectorLabWorkspace({ active }: { active: boolean }) {
  const view = useSessionStore((s) => s.labView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const isTerminalCollapsed = useSessionStore((s) => s.isTerminalCollapsed);
  const setTerminalCollapsed = useSessionStore((s) => s.setTerminalCollapsed);
  const userId = useAuthStore((s) => s.user?.id);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const closeInspector = () => {
    setInspectorOpen(false);
    requestAnimationFrame(() => inspectorToggleRef.current?.focus());
  };
  const { data: status } = useQuery({ queryKey: ["dbStatus"], queryFn: getStatus, retry: false });
  const { data: sample } = useQuery({
    queryKey: ["vectorSample", userId, status?.total_docs],
    queryFn: () => getVectorSample(2000),
    enabled: userId !== undefined && !!status,
  });
  const refreshLab = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all(["dbStatus", "vectorSample", "benchmarks", "search"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })));
    } catch {
      // Individual queries surface their own error state.
    } finally {
      setIsRefreshing(false);
    }
  };
  return (
    <section aria-label="Vector Lab workspace" inert={!active} className={`${active ? "flex" : "hidden"} flex-1 min-h-0 min-w-0 flex-col`}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[--border-subtle] bg-panel/40 px-4 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-2xs uppercase tracking-wider text-[--text-secondary]">
          <span className="text-[--color-info]">Engineering console</span>
          <span>Your vectors <span className="text-[--text-primary]">{sample?.count.toLocaleString() ?? "—"}</span></span>
          <span className="hidden sm:inline">Shared index <span className="text-[--text-primary]">{status?.engine.toUpperCase() ?? "—"}</span></span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => void refreshLab()} disabled={isRefreshing} aria-label="Refresh Lab data"
            className="inline-flex items-center gap-1.5 text-xs text-[--text-secondary] hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
          </button>
          {view === "space" && <button ref={inspectorToggleRef} type="button" onClick={() => {
            if (inspectorOpen) closeInspector();
            else {
              setInspectorOpen(true);
              requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('aside[aria-label="Vector inspector"] button[aria-label="Close vector inspector"]')?.focus());
            }
          }} aria-label={inspectorOpen ? "Close vector inspector" : "Open vector inspector"}
            className="inline-flex items-center gap-1.5 text-xs text-[--text-secondary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] xl:hidden">
            <PanelRightOpen className="h-3.5 w-3.5" /> Inspector
          </button>}
          <button type="button" onClick={() => setTerminalCollapsed(!isTerminalCollapsed)} aria-label={isTerminalCollapsed ? "Open terminal" : "Close terminal"}
            className="inline-flex items-center gap-1.5 text-xs text-[--text-secondary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">
            <Terminal className="h-3.5 w-3.5" /> {isTerminalCollapsed ? "Open terminal" : "Close terminal"}
          </button>
        </div>
      </div>
      <nav aria-label="Vector Lab sections" className="flex shrink-0 gap-1 px-4 border-b border-[--border-subtle] overflow-x-auto">
        {SECTIONS.map(({ view: section, label, icon: Icon }) => (
          <button type="button" key={section} onClick={() => openVectorLab(section)} aria-current={view === section ? "page" : undefined}
            className={`flex items-center gap-2 px-3 py-3 text-xs whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:bg-hover ${view === section ? "border-white text-white" : "border-transparent text-[#888] hover:text-white"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </nav>
      {active && view === "space" && <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <VectorSpaceCanvas />
        <div className={`${inspectorOpen ? "flex" : "hidden"} absolute inset-y-0 right-0 z-30 w-[min(320px,calc(100vw-5rem))] min-w-0 border-l border-[--border-default] shadow-[-16px_0_40px_rgba(0,0,0,0.45)] xl:static xl:z-auto xl:flex xl:w-[300px] xl:shrink-0 xl:shadow-none`}>
          <VectorInspector status={status} count={sample?.count} onClose={closeInspector} />
        </div>
      </div>}
      <div className={`${view === "space" ? "hidden" : "block"} flex-1 min-h-0 overflow-y-auto p-4 sm:p-6`}>
          <div className="max-w-5xl mx-auto w-full">
            <div className={view === "engine" ? "block" : "hidden"} inert={view !== "engine"}><EnginePanel /></div>
            {active && view === "benchmarks" && <BenchmarksPanel />}
            <div className={view === "maintenance" ? "block" : "hidden"} inert={view !== "maintenance"}><MaintenancePanel /></div>
          </div>
      </div>
    </section>
  );
}
