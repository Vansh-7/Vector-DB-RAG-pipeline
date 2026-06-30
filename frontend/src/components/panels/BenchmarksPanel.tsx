import { useQuery } from "@tanstack/react-query";
import type { AlgorithmBenchmark } from "../../types";
import { getLatencyColor } from "../../lib/utils";
import { getBenchmarks } from "../../api/benchmark";
import { useEngineStore } from "../../store/engineStore";

const MOCK_BENCHMARKS: AlgorithmBenchmark[] = [
  { name: "hnsw", displayName: "HNSW Graph", latencyMs: 1.2, throughputQps: 850, isActive: true },
  { name: "kdtree", displayName: "KD-Tree", latencyMs: 4.8, throughputQps: 450, isActive: false },
  { name: "exact", displayName: "Brute Force (Exact Match)", latencyMs: 45.0, throughputQps: 22, isActive: false },
];

export function BenchmarksPanel() {
  const currentAlgorithm = useEngineStore((s) => s.algorithm);
  
  const { data } = useQuery({
    queryKey: ["benchmarks"],
    queryFn: getBenchmarks,
    refetchInterval: 5000,
  });

  const benchmarks = (data?.algorithms ?? MOCK_BENCHMARKS).map((b) => ({
    ...b,
    isActive: b.name === currentAlgorithm,
  }));
  
  const maxQps = Math.max(...benchmarks.map((b) => b.throughputQps), 1);

  return (
    <div className="p-4 space-y-4">
      <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
        Algorithm Performance
      </div>

      {benchmarks.map((algo) => {
        const barWidth = (algo.throughputQps / maxQps) * 100;

        return (
          <div key={algo.name} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[#f4f4f4]">
                {algo.displayName}
              </span>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-[#555] tracking-widest uppercase">
                    Latency
                  </span>
                  <span
                    className="font-mono text-xs"
                    style={{ color: getLatencyColor(algo.latencyMs) }}
                  >
                    {algo.latencyMs.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-[#555] tracking-widest uppercase">
                    Throughput
                  </span>
                  <span className="font-mono text-xs text-[#888]">
                    {Math.round(algo.throughputQps)} QPS
                  </span>
                </div>
              </div>
            </div>
            <div className="w-full h-1 rounded-full bg-[rgba(255,255,255,0.06)]">
              <div
                className="h-1 rounded-full bg-[#22c55e] transition-all duration-500"
                style={{
                  width: `${barWidth}%`,
                  boxShadow: algo.isActive ? "0 0 8px rgba(34,197,94,0.4)" : "none",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
