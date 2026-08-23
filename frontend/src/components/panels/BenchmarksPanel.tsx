import { useQuery } from "@tanstack/react-query";
import { getLatencyColor, formatNumber } from "../../lib/utils";
import { getBenchmarks } from "../../api/benchmark";
import { useSessionStore } from "../../store/sessionStore";
import { Layers } from "lucide-react";

export function BenchmarksPanel() {
  
  const searchQuery = useSessionStore((s) => s.searchQuery);

  const { data, isLoading } = useQuery({
    queryKey: ["benchmarks", searchQuery],
    queryFn: () => getBenchmarks(searchQuery),
  });

  const benchmarks = data?.algorithms || [];
  const maxQps = Math.max(...benchmarks.map((b) => b.throughputQps), 1);
  const isHnswActive = benchmarks.find((b) => b.isActive)?.name === 'hnsw';

  return (
    <div className="p-4 space-y-6">
      {isLoading && !data ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
              Algorithm Telemetry
            </div>
            <div className="text-xs text-[#888] leading-relaxed">
              Compare index latency and maximum QPS (Queries Per Second).
            </div>
          </div>

          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-[#161616] rounded animate-pulse" />
                <div className="flex gap-4">
                  <div className="h-4 w-20 bg-[#161616] rounded animate-pulse" />
                  <div className="h-4 w-20 bg-[#161616] rounded animate-pulse" />
                </div>
              </div>
              <div className="w-full h-1 rounded-full bg-[#161616] animate-pulse" />
            </div>
          ))}
          <div className="w-full h-px bg-[rgba(255,255,255,0.06)] my-6" />
          <div className="space-y-4">
            <div className="h-4 w-40 bg-[#161616] rounded animate-pulse" />
            <div className="h-20 w-full bg-[#161616] rounded animate-pulse" />
            <div className="h-20 w-full bg-[#161616] rounded animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <div className="text-2xs font-medium tracking-widest text-[#555] uppercase">
                Algorithm Telemetry
              </div>
              <div className="text-xs text-[#888] leading-relaxed">
                Compare index latency and maximum QPS (Queries Per Second).
              </div>
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
                  <div className="w-full h-1.5 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor: algo.isActive ? "#3b82f6" : "#22c55e",
                        boxShadow: algo.isActive ? "0 0 8px rgba(59,130,246,0.4)" : "none",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="w-full h-px bg-[rgba(255,255,255,0.06)]" />

          {/* HNSW Graph Layers Panel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-2xs font-medium tracking-widest text-[#555] uppercase">
                <Layers className="w-3.5 h-3.5" />
                Index Topology
              </div>
              {isHnswActive ? (
                <span className="text-[9px] uppercase tracking-wider text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded-[2px] font-medium border border-[#3b82f6]/20">Active</span>
              ) : (
                <span className="text-[9px] uppercase tracking-wider text-[#888] bg-white/5 px-1.5 py-0.5 rounded-[2px] font-medium border border-white/10">Inactive</span>
              )}
            </div>

            <div className="space-y-2">
              {data?.topology && data?.topology.length > 0 ? (
                data?.topology.map((layer) => (
                  <div key={layer.level} className="flex flex-col gap-1 border border-[rgba(255,255,255,0.06)] rounded-[6px] p-3.5 bg-[#161616] hover:bg-[#1a1a1a] transition-colors">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-[#f4f4f4]">
                        {layer.level === 0 ? "Base Layer (L0)" : `Navigable Layer (L${layer.level})`}
                      </span>
                      <span className="text-[10px] font-mono text-[#888] bg-white/5 px-1.5 py-[1px] rounded-sm" title="Maximum Connections per Element">
                        {layer.level === 0 ? "M0 = 32" : "M = 16"}
                      </span>
                    </div>
                    <div className="flex gap-6 mt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-[#555] uppercase tracking-wider">Nodes</span>
                        <span className="font-mono text-xs text-[#a78bfa]">{formatNumber(layer.nodes)}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-[#555] uppercase tracking-wider">Edges</span>
                        <span className="font-mono text-xs text-[#888]">{formatNumber(layer.edges)}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#555] py-4 text-center border border-[rgba(255,255,255,0.02)] rounded-[6px]">
                  No topology data available (Index might be empty or not HNSW)
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 p-3 rounded-[6px] bg-[#111] border border-[rgba(255,255,255,0.04)]">
                <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] mt-1 shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] text-[#777] leading-relaxed">
                    Graph topography is derived dynamically from the active index memory state.
                  </p>
                  <p className="text-[11px] text-[#555] leading-relaxed">
                    <strong>HNSW</strong> (Hierarchical Navigable Small World) uses multi-layered graphs for fast approximate search. <strong>L0</strong> contains all elements, while <strong>L1+</strong> are sparser expressways.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
