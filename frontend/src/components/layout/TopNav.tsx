import { useState } from "react";
import { Trash2, Save, Activity } from "lucide-react";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { useCanvasStore } from "../../store/canvasStore";
import { useTerminalStore } from "../../store/terminalStore";
import { useEngineStore } from "../../store/engineStore";
import { ALGORITHM_DISPLAY } from "../../types/vector";
import { getCurrentTimestamp } from "../../lib/utils";

export function TopNav() {
  const [showClearDialog, setShowClearDialog] = useState(false);

  const clearAll = useCanvasStore((s) => s.clearAll);
  const addLog = useTerminalStore((s) => s.addLog);
  const algorithm = useEngineStore((s) => s.algorithm);

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
      <header className="h-12 bg-panel border-b border-[rgba(255,255,255,0.06)] flex items-center px-4 shrink-0 justify-between">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-2.5 mr-6">
            <span className="nav-mark">∇</span>
            <span className="nav-wordmark">nabla</span>
            <span className="nav-version-chip">vector engine</span>
          </div>

          {/* Dynamic Badges */}
          <div className="flex items-center h-full border-l border-[rgba(255,255,255,0.06)] pl-4">
            <div className="flex items-center gap-2 px-3">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
              </div>
              <span className="text-xs font-medium text-[#888] tracking-wide">API Online</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 border-l border-[rgba(255,255,255,0.06)]">
              <Activity className="w-3.5 h-3.5 text-[#555]" />
              <span className="text-xs font-medium text-[#888] tracking-wide">
                Index: <span className="text-[#f4f4f4]">{ALGORITHM_DISPLAY[algorithm]}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowClearDialog(true)}
            className="border border-[#ef4444] text-[#ef4444] text-xs rounded-[4px] px-3 py-1.5 hover:bg-[#ef4444]/10 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3 h-3" />
            Clear DB
          </button>
          <button className="border border-[rgba(255,255,255,0.15)] text-[#f4f4f4] text-xs rounded-[4px] px-3 py-1.5 hover:bg-[rgba(255,255,255,0.05)] transition-colors flex items-center gap-1.5">
            <Save className="w-3 h-3" />
            Save to Disk
          </button>
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
