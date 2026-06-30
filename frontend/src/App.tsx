import { TopNav } from "./components/layout/TopNav";
import { Sidebar } from "./components/layout/Sidebar";
import { RightPanel } from "./components/layout/RightPanel";
import { VectorSpaceCanvas } from "./components/canvas/VectorSpaceCanvas";
import { DataLoader } from "./components/DataLoader";
import { useCanvasStore } from "./store/canvasStore";
import { formatNumber } from "./lib/utils";

export default function App() {
  const meta = useCanvasStore((s) => s.meta);
  
  const showSampleNote = meta && meta.totalVectors > 2000;

  return (
    <div className="h-screen w-screen bg-base text-[#f4f4f4] font-sans flex flex-col overflow-hidden min-w-[1280px]">
      <DataLoader />
      <TopNav />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        {/* Canvas area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <VectorSpaceCanvas />

          {/* Canvas footer */}
          <div className="h-10 border-t border-[rgba(255,255,255,0.06)] bg-panel flex items-center px-4 gap-6 shrink-0 relative">
            <div>
              <span className="text-2xs text-[#555] uppercase tracking-wider">
                Dimensions
              </span>
              <span className="ml-2 text-md font-mono font-medium">
                {meta?.dimensions ?? 1536}
              </span>
            </div>
            <div className="w-px h-4 bg-[rgba(255,255,255,0.06)]" />
            <div className="flex items-center gap-3">
              <div>
                <span className="text-2xs text-[#555] uppercase tracking-wider">
                  Total Vectors
                </span>
                <span className="ml-2 text-md font-mono font-medium">
                  {meta ? formatNumber(meta.totalVectors) : "—"}
                </span>
              </div>
              {showSampleNote && (
                <div className="px-2 py-0.5 rounded-[3px] bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)]">
                  <span className="text-2xs text-[#888] font-mono">
                    /vectors/sample?n=2000
                  </span>
                </div>
              )}
            </div>
          </div>
        </main>

        <RightPanel />
      </div>
    </div>
  );
}
