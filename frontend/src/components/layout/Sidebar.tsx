import { useState, useEffect } from "react";
import { RefreshCw, Loader2, PanelLeftClose, PanelLeftOpen, Settings2, PlusSquare } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { Slider } from "../ui/Slider";
import { Tooltip } from "../ui/Tooltip";
import { useEngineStore } from "../../store/engineStore";
import { useSessionStore } from "../../store/sessionStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useTerminalStore } from "../../store/terminalStore";
import { insertVector } from "../../api/vectors";
import { configureEngine } from "../../api/engine";
import { getCurrentTimestamp } from "../../lib/utils";
import {
  ALGORITHM_DISPLAY,
  METRIC_DISPLAY,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  type Algorithm,
  type Category,
  type DistanceMetric,
} from "../../types/vector";

const ALGORITHM_OPTIONS = Object.entries(ALGORITHM_DISPLAY).map(([value, label]) => ({
  value,
  label,
}));

const METRIC_OPTIONS = Object.entries(METRIC_DISPLAY).map(([value, label]) => ({
  value,
  label,
}));

const CATEGORY_OPTIONS: { value: Category; label: string }[] = CATEGORY_ORDER
  .filter(value => value !== 'DOCUMENTS')
  .map(value => ({
    value,
    label: CATEGORY_LABELS[value],
  }));

export function Sidebar() {
  const { algorithm, metric, topK, category, setAlgorithm, setMetric, setTopK, setCategory } =
    useEngineStore();
  const { isSidebarCollapsed, setSidebarCollapsed } = useSessionStore();

  const [payload, setPayload] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState("just now");

  const addPendingInsert = useCanvasStore((s) => s.addPendingInsert);
  const addLog = useTerminalStore((s) => s.addLog);
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => {
      setLastSynced(prev => {
        if (prev === "just now") return "1m ago";
        if (prev.endsWith("m ago")) {
          const mins = parseInt(prev) + 1;
          return `${mins}m ago`;
        }
        return prev;
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [isSyncing]);

  const handleSync = async () => {
    setIsSyncing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => {
      setIsSyncing(false);
      setLastSynced("just now");
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: "Cluster data synced successfully.",
      });
    }, 800);
  };

  const mutation = useMutation({
    mutationFn: () => insertVector({ category, payload }),
    onSuccess: (data) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: data.message || "Vector inserted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
      queryClient.invalidateQueries({ queryKey: ["vectorSample"] });
      setPayload("");
    },
    onError: (err) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "ERROR",
        message: `Failed to insert vector: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    },
  });

  const handleAlgorithmChange = async (newAlgo: Algorithm) => {
    setAlgorithm(newAlgo);
    addLog({
      timestamp: getCurrentTimestamp(),
      level: "INFO",
      message: `Rebuilding index as ${ALGORITHM_DISPLAY[newAlgo]}...`,
    });
    try {
      await configureEngine(newAlgo, metric);
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "SUCCESS",
        message: `Engine switched to ${ALGORITHM_DISPLAY[newAlgo]}`,
      });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
      queryClient.invalidateQueries({ queryKey: ["vectorSample"] });
    } catch (e) {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "ERROR",
        message: `Engine switch failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
    }
  };

  const handleMetricChange = async (newMetric: DistanceMetric) => {
    setMetric(newMetric);
    addLog({
      timestamp: getCurrentTimestamp(),
      level: "INFO",
      message: `Switching metric to ${METRIC_DISPLAY[newMetric]}...`,
    });
    try {
      await configureEngine(algorithm, newMetric);
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "SUCCESS",
        message: `Metric switched to ${METRIC_DISPLAY[newMetric]}`,
      });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
      queryClient.invalidateQueries({ queryKey: ["vectorSample"] });
    } catch (e) {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "ERROR",
        message: `Metric switch failed: ${e instanceof Error ? e.message : "Unknown error"}`,
      });
    }
  };

  if (isSidebarCollapsed) {
    return (
      <aside className="w-[56px] border-r border-[rgba(255,255,255,0.06)] bg-panel flex flex-col items-center shrink-0 py-4 transition-all duration-300">
        <Tooltip content="Expand Sidebar" side="right">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="w-8 h-8 mb-6 rounded-md flex items-center justify-center text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#555]"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        </Tooltip>

        <div className="flex-1 flex flex-col gap-6 w-full items-center">
          <Tooltip content="Engine Configuration">
            <button className="w-8 h-8 rounded-md flex items-center justify-center text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#555]" onClick={() => setSidebarCollapsed(false)}>
              <Settings2 className="w-4 h-4" />
            </button>
          </Tooltip>

          <div className="w-6 h-px bg-[rgba(255,255,255,0.06)]" />

          <Tooltip content="Manual Vector Injection">
            <button className="w-8 h-8 rounded-md flex items-center justify-center text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#555]" onClick={() => setSidebarCollapsed(false)}>
              <PlusSquare className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        <Tooltip content={isSyncing ? "Syncing..." : `Sync Cluster (${lastSynced})`}>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className={`w-8 h-8 rounded-md flex items-center justify-center text-[#888] hover:text-[#f4f4f4] transition-colors focus:outline-none focus:ring-2 focus:ring-[#555] ${isSyncing ? "opacity-50 cursor-not-allowed" : "hover:bg-[#1a1a1a]"}`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
          </button>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside className="w-[260px] border-r border-[rgba(255,255,255,0.06)] bg-panel flex flex-col shrink-0 transition-all duration-300">
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
          Engine Configuration
        </div>
        <Tooltip content="Collapse Sidebar" side="right">
          <button
            onClick={() => setSidebarCollapsed(true)}
            className="w-8 h-8 -mr-2 rounded-md flex items-center justify-center text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] transition-colors focus:outline-none focus:ring-2 focus:ring-[#555]"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 pt-4">

        <div className="space-y-3">
          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Index Algorithm
            </label>
            <Select
              value={algorithm}
              onValueChange={(v) => handleAlgorithmChange(v as Algorithm)}
              options={ALGORITHM_OPTIONS}
            />
          </div>

          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Distance Metric
            </label>
            <Select
              value={metric}
              onValueChange={(v) => handleMetricChange(v as DistanceMetric)}
              options={METRIC_OPTIONS}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-2xs font-medium tracking-widest text-[#555] uppercase">
                Top K Retrieval
              </label>
              <span className="font-mono text-xs text-[#f4f4f4]">{topK}</span>
            </div>
            <Slider value={topK} onValueChange={setTopK} min={1} max={20} />
            <div className="flex justify-between mt-1">
              <span className="text-2xs text-[#555]">1</span>
              <span className="text-2xs text-[#555]">20</span>
            </div>
          </div>
        </div>

        {/* Separator */}
        <div className="h-px bg-[rgba(255,255,255,0.06)]" />

        {/* Manual Vector Injection */}
        <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
          Manual Vector Injection
        </div>
        <div className="text-xs text-[#888] leading-tight mb-2">Inject raw data directly into the index for immediate retrieval.</div>

        <div className="space-y-3">
          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Category
            </label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
              options={CATEGORY_OPTIONS}
            />
          </div>

          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Data Payload
            </label>
            <textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Enter text to be embedded..."
              className="w-full min-h-[80px] bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm font-mono text-[#f4f4f4] placeholder:text-[#555] outline-none resize-none focus:border-[rgba(255,255,255,0.18)] transition-colors focus:outline-none focus:ring-1 focus:ring-[#555]"
            />
          </div>

          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !payload.trim()}
            className="w-full py-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Inject Vector
          </Button>
        </div>
      </div>

      {/* Sync Cluster - Status Bar Item */}
      <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#0f0f0f] px-4 py-3 flex items-center shrink-0">
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center justify-between gap-2 text-xs font-medium text-[#888] hover:text-[#f4f4f4] transition-colors w-full rounded-md py-1.5 px-3 hover:bg-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#555] border border-transparent hover:border-[rgba(255,255,255,0.06)]"
        >
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#f4f4f4]" : ""}`} />
            <span className={isSyncing ? "text-[#f4f4f4]" : ""}>{isSyncing ? "Syncing..." : "Sync Cluster"}</span>
          </div>
          {!isSyncing && <span className="text-2xs text-[#555]">{lastSynced}</span>}
        </button>
      </div>
    </aside>
  );
}
