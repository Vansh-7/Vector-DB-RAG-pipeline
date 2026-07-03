import { useState } from "react";
import { Trash2, Save } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { useCanvasStore } from "../../store/canvasStore";
import { useTerminalStore } from "../../store/terminalStore";
import { useEngineStore } from "../../store/engineStore";
import { ALGORITHM_DISPLAY } from "../../types/vector";
import { getCurrentTimestamp } from "../../lib/utils";

export function TopNav() {
  const [showClearDialog, setShowClearDialog] = useState(false);

  const clearAll = useCanvasStore((s) => s.clearAll);
  const addLog = useTerminalStore((s) => s.addLog);
  const { algorithm, modelName } = useEngineStore();

  const handleClear = () => {
    addLog({
      timestamp: getCurrentTimestamp(),
      level: "INFO",
      message: "Canvas cleared locally (no backend delete endpoint).",
    });
    clearAll();
    setShowClearDialog(false);
  };

  return (
    <>
      <header className="h-12 bg-panel border-b border-[rgba(255,255,255,0.06)] flex items-center px-4 shrink-0 justify-between relative">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-3 mr-6 group">
            {/* Nabla SVG Mark with glow */}
            <div className="relative flex items-center justify-center w-5 h-5">
              <div className="absolute inset-0 bg-tech/30 blur-md rounded-full opacity-50 group-hover:opacity-80 transition-opacity"></div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#f4f4f4] relative z-10">
                <polygon points="12 22 2 4 22 4 12 22" />
              </svg>
            </div>
            
            {/* Brand text */}
            <div className="flex items-center gap-2.5">
              <span className="font-brand font-bold text-sm tracking-[0.2em] text-[#f4f4f4] uppercase">
                NABLA
              </span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-[3px] bg-[#1a1a1a] text-[#555] border border-[rgba(255,255,255,0.04)] uppercase tracking-wider">
                Vector Engine
              </span>
            </div>
          </div>
        </div>

        {/* Centered Status Strip */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 hidden md:flex">
          <div className="flex items-center border border-[rgba(255,255,255,0.06)] rounded-[4px] px-2 py-1 bg-[#0f0f0f] font-mono text-[10px] text-[#888]">
            <div className="flex items-center gap-1.5 px-2">
              <div className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22c55e]"></span>
              </div>
              <span className="text-[#f4f4f4]">API Online</span>
            </div>
            
            <div className="w-px h-3 bg-[rgba(255,255,255,0.06)] mx-1" />
            
            <div className="flex items-center px-2">
              <span className="mr-1.5">Index:</span>
              <span className="text-[#f4f4f4]">{ALGORITHM_DISPLAY[algorithm].toUpperCase()}</span>
            </div>

            <div className="w-px h-3 bg-[rgba(255,255,255,0.06)] mx-1" />
            
            <div className="flex items-center px-2">
              <span className="mr-1.5">LLM:</span>
              <span className="text-[#f4f4f4]">{modelName.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10">
          <Button variant="danger" onClick={() => setShowClearDialog(true)}>
            <Trash2 className="w-3 h-3" />
            Clear DB
          </Button>
          <Button variant="outline">
            <Save className="w-3 h-3" />
            Save to Disk
          </Button>
        </div>
      </header>

      <ConfirmDialog
        open={showClearDialog}
        onOpenChange={setShowClearDialog}
        title="Clear Database"
        description="This will permanently delete all vectors in the database. This action cannot be undone."
        confirmLabel="Yes, Clear Canvas"
        onConfirm={handleClear}
        destructive
      />
    </>
  );
}
