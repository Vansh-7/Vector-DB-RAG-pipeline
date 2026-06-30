import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Select } from "../ui/Select";
import { Slider } from "../ui/Slider";
import { useEngineStore } from "../../store/engineStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useTerminalStore } from "../../store/terminalStore";
import { insertVector } from "../../api/vectors";
import { configureEngine } from "../../api/engine";
import { getCurrentTimestamp } from "../../lib/utils";
import {
  ALGORITHM_DISPLAY,
  METRIC_DISPLAY,
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

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "TECH", label: "Tech" },
  { value: "FINANCE", label: "Finance" },
  { value: "FOOD", label: "Food" },
  { value: "SPORTS & GAMES", label: "Sports & Games" },
  { value: "DOCUMENTS", label: "Documents" },
  { value: "MATHEMATICS", label: "Mathematics" },
];

export function Sidebar() {
  const { algorithm, metric, topK, category, setAlgorithm, setMetric, setTopK, setCategory } =
    useEngineStore();
  const [payload, setPayload] = useState("");
  const addPendingInsert = useCanvasStore((s) => s.addPendingInsert);
  const addLog = useTerminalStore((s) => s.addLog);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => insertVector({ category, payload }),
    onSuccess: (data) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: `Inserted vector ${data.id} at [${data.x.toFixed(2)}, ${data.y.toFixed(2)}]`,
      });
      addPendingInsert({
        id: data.id,
        x: data.x,
        y: data.y,
        category: data.category,
        payload,
      });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
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

  return (
    <aside className="w-[260px] border-r border-[rgba(255,255,255,0.06)] bg-panel flex flex-col shrink-0">
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Engine Configuration */}
        <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
          Engine Configuration
        </div>

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

        {/* Single Vector Entry */}
        <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
          Single Vector Entry
        </div>

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
              placeholder="Enter vector data..."
              className="w-full min-h-[80px] bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm font-mono text-[#f4f4f4] placeholder:text-[#555] outline-none resize-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
            />
          </div>

          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !payload.trim()}
            className="w-full bg-white text-black text-sm font-medium rounded-[4px] py-2 hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Insert Vector
          </button>
        </div>
      </div>

      {/* Sync Cluster - Status Bar Item */}
      <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#0f0f0f] px-3 py-2.5 flex items-center shrink-0">
        <button
          onClick={() => queryClient.invalidateQueries()}
          className="flex items-center justify-center gap-2 text-xs font-medium text-[#666] hover:text-[#f4f4f4] transition-colors w-full rounded-sm py-1 hover:bg-[#1a1a1a]"
          title="Force Sync Cluster Data"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Sync Cluster</span>
        </button>
      </div>
    </aside>
  );
}
