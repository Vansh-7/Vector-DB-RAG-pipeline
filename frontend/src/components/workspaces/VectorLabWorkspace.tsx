import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Network, PanelRightOpen, RefreshCw, Settings2, Terminal, Wrench } from "lucide-react";
import { getStatus } from "../../api/status";
import { useVectorSample } from "../../hooks/useVectorSample";
import { useSessionStore, type LabView } from "../../store/sessionStore";
import { VectorInspector } from "../canvas/VectorInspector";
import { VectorSpaceCanvas } from "../canvas/VectorSpaceCanvas";
import { BenchmarksPanel } from "../panels/BenchmarksPanel";
import { EnginePanel } from "../panels/EnginePanel";
import { MaintenancePanel } from "../panels/MaintenancePanel";
import type { VectorPoint2D } from "../../types/vector";
import { ALGORITHM_DISPLAY, METRIC_DISPLAY } from "../../types/vector";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";
import { Button } from "../ui/Button";
import { useAuthStore } from "../../store/authStore";

const EMPTY_VECTORS: VectorPoint2D[] = [];

const SECTIONS = [
  { view: "space", label: "Vector Space", icon: Network },
  { view: "engine", label: "Engine", icon: Settings2 },
  { view: "benchmarks", label: "Benchmarks", icon: Activity },
  { view: "maintenance", label: "Maintenance", icon: Wrench },
] satisfies { view: LabView; label: string; icon: typeof Network }[];

export function VectorLabWorkspace({ active }: { active: boolean }) {
  const view = useSessionStore((s) => s.labView);
  const isOperator = useAuthStore((s) => s.user?.is_operator === true);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const isTerminalCollapsed = useSessionStore((s) => s.isTerminalCollapsed);
  const setTerminalCollapsed = useSessionStore((s) => s.setTerminalCollapsed);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const inspectorToggleRef = useRef<HTMLButtonElement>(null);
  const closeInspector = () => {
    setInspectorOpen(false);
    requestAnimationFrame(() => inspectorToggleRef.current?.focus());
  };
  const { data: status, isError: statusError, isPending: statusPending } = useQuery({ queryKey: ["dbStatus"], queryFn: getStatus, retry: false });
  const sampleQuery = useVectorSample();
  const sample = sampleQuery.data;
  const vectors = sample?.vectors ?? EMPTY_VECTORS;
  useEffect(() => {
    if (!active || view !== "space") setInspectorOpen(false);
  }, [active, view]);
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
      <WorkspaceHeader view="vector-lab">
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" onClick={() => void refreshLab()} disabled={isRefreshing} aria-label="Refresh Lab data">
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} /> <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button type="button" variant="ghost" onClick={() => setTerminalCollapsed(!isTerminalCollapsed)} aria-label={isTerminalCollapsed ? "Open terminal" : "Close terminal"} aria-expanded={!isTerminalCollapsed}>
            <Terminal className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Terminal</span>
          </Button>
        </div>
      </WorkspaceHeader>
      <nav aria-label="Vector Lab sections" className="lab-tabs">
        {SECTIONS.map(({ view: section, label, icon: Icon }) => (
          <button type="button" key={section} onClick={() => openVectorLab(section)} aria-current={view === section ? "page" : undefined}
            className="lab-tab">
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </nav>
      <div aria-label={`${SECTIONS.find((section) => section.view === view)?.label} context`} className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[--border-subtle] px-5 sm:px-7 py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[--text-secondary]">
          <span role="status" className="flex items-center gap-1.5"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${statusError ? "bg-error" : statusPending ? "bg-warning" : "bg-success"}`} />API · <span className="text-[--text-primary]">{statusError ? "Offline" : statusPending ? "Connecting" : "Online"}</span></span>
          {(view === "space" || view === "benchmarks" || view === "maintenance") && <span>Your vectors · <span className="font-mono text-[--text-primary]">{sampleQuery.isError ? "—" : sample?.count.toLocaleString() ?? "—"}</span></span>}
          {view !== "maintenance" && <>
            <span>{view === "benchmarks" ? "Active index" : "Shared index"} · <span className="font-mono text-[--text-primary]">{status && !statusError ? ALGORITHM_DISPLAY[status.engine] : "—"}</span></span>
            <span>Metric · <span className="font-mono text-[--text-primary]">{status && !statusError ? METRIC_DISPLAY[status.metric] : "—"}</span></span>
          </>}
          {view === "engine" && <span>Shared configuration · <span className="text-[--text-primary]">{isOperator ? "Operator access" : "Read-only"}</span></span>}
          {view === "maintenance" && <span>Shared snapshots · <span className="text-[--text-primary]">{isOperator ? "Operator access" : "Operator-only"}</span></span>}
        </div>
        {view === "space" && <Button ref={inspectorToggleRef} type="button" variant="ghost" onClick={() => {
          if (inspectorOpen) closeInspector();
          else {
            setInspectorOpen(true);
            requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('aside[aria-label="Vector inspector"] button[aria-label="Close vector inspector"]')?.focus());
          }
        }} aria-label={inspectorOpen ? "Close vector inspector" : "Open vector inspector"} className="xl:hidden !h-7 !px-1 text-xs"><PanelRightOpen className="h-3.5 w-3.5" /> Inspector</Button>}
      </div>
      {view === "space" && sampleQuery.isError && <div role="alert" className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-error/20 bg-error/5 px-4 py-2 text-xs text-error">
        <span>Vector sample is unavailable. {sampleQuery.error instanceof Error ? sampleQuery.error.message : "Try again."}</span>
        <button type="button" onClick={() => void sampleQuery.refetch()} className="rounded text-[--color-info] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Retry sample</button>
      </div>}
      {active && view === "space" && <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <VectorSpaceCanvas vectors={vectors} count={sample?.count} />
        {sampleQuery.isPending && !sampleQuery.isError && <div role="status" className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 text-xs text-[--text-secondary]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading vector space…</div>}
        <div className={`${inspectorOpen ? "flex" : "hidden"} absolute inset-y-0 right-0 z-30 w-[min(280px,calc(100vw-5rem))] min-w-0 border-l border-[--border-default] xl:static xl:z-auto xl:flex xl:w-[240px] xl:shrink-0`}>
          <VectorInspector status={status} vectors={vectors} count={sample?.count} onClose={closeInspector} />
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
