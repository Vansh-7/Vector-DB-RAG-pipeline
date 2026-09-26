import { Activity, Network, Settings2, Wrench } from "lucide-react";
import { useSessionStore, type LabView } from "../../store/sessionStore";
import { VectorSpaceCanvas } from "../canvas/VectorSpaceCanvas";
import { Sidebar } from "../layout/Sidebar";
import { BenchmarksPanel } from "../panels/BenchmarksPanel";
import { MaintenancePanel } from "../panels/MaintenancePanel";

const SECTIONS = [
  { view: "space", label: "Vector Space", icon: Network },
  { view: "engine", label: "Engine & Injection", icon: Settings2 },
  { view: "benchmarks", label: "Benchmarks", icon: Activity },
  { view: "maintenance", label: "Maintenance", icon: Wrench },
] satisfies { view: LabView; label: string; icon: typeof Network }[];

export function VectorLabWorkspace({ active }: { active: boolean }) {
  const view = useSessionStore((s) => s.labView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  return (
    <section aria-label="Vector Lab workspace" inert={!active} className={`${active ? "flex" : "hidden"} flex-1 min-h-0 min-w-0 flex-col`}>
      <nav aria-label="Vector Lab sections" className="flex shrink-0 gap-1 px-4 border-b border-[--border-subtle] overflow-x-auto">
        {SECTIONS.map(({ view: section, label, icon: Icon }) => (
          <button type="button" key={section} onClick={() => openVectorLab(section)} aria-current={view === section ? "page" : undefined}
            className={`flex items-center gap-2 px-3 py-3 text-xs whitespace-nowrap border-b-2 transition-colors focus-visible:outline-none focus-visible:bg-hover ${view === section ? "border-white text-white" : "border-transparent text-[#888] hover:text-white"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </nav>
      {active && view === "space" && <VectorSpaceCanvas />}
      <div className={`${view === "space" ? "hidden" : "block"} flex-1 min-h-0 overflow-y-auto p-4 sm:p-6`}>
          <div className="max-w-3xl mx-auto w-full">
            <div className={view === "engine" ? "block" : "hidden"} inert={view !== "engine"}><Sidebar embedded /></div>
            {active && view === "benchmarks" && <BenchmarksPanel />}
            <div className={view === "maintenance" ? "block" : "hidden"} inert={view !== "maintenance"}><MaintenancePanel /></div>
          </div>
      </div>
    </section>
  );
}
