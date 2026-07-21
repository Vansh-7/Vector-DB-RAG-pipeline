import { useEffect, useState } from "react";
import { Search, X, Fingerprint, ChevronRight, Trash2 } from "lucide-react";
import { useSessionStore } from "../../store/sessionStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { search } from "../../api/search";
import { deleteVector } from "../../api/vectors";
import { useEngineStore } from "../../store/engineStore";
import { useCanvasStore } from "../../store/canvasStore";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../types/vector";

export function SearchPanel() {
  const query = useSessionStore((s) => s.searchInputValue);
  const setQuery = useSessionStore((s) => s.setSearchInputValue);
  const searchQuery = useSessionStore((s) => s.searchQuery);
  const setSearchQuery = useSessionStore((s) => s.setSearchQuery);
  const dismissedIdsArr = useSessionStore((s) => s.searchDismissedIds);
  const setDismissedIdsArr = useSessionStore((s) => s.setSearchDismissedIds);

  // Use a local Set for fast lookups, syncing with the global array
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set(dismissedIdsArr));

  useEffect(() => {
    setDismissedIdsArr(Array.from(dismissedIds));
  }, [dismissedIds, setDismissedIdsArr]);

  const algorithm = useEngineStore((s) => s.algorithm);
  const metric = useEngineStore((s) => s.metric);
  const topK = useEngineStore((s) => s.topK);
  const category = useEngineStore((s) => s.category);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const setActiveTab = useSessionStore((s) => s.setActiveTab);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["search", searchQuery, algorithm, metric, topK, category],
    queryFn: () =>
      search({
        q: searchQuery,
        k: topK,
        algorithm,
        metric,
        category,
      }),
    enabled: searchQuery.trim().length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deleteVector,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
      queryClient.invalidateQueries({ queryKey: ["vectorSample"] });
      setHighlighted([]);
    }
  });

  const handleSearch = () => {
    if (query.trim()) {
      setDismissedIds(new Set());
      setSearchQuery(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleClear = () => {
    setQuery("");
    setSearchQuery("");
    setDismissedIds(new Set());
    setHighlighted([]);
  };

  useEffect(() => {
    if (data?.results && data.results.length > 0) {
      const scores = Object.fromEntries(data.results.map(r => [r.id, r.score]));
      setHighlighted(data.results.map(r => r.id), scores);
    }
  }, [data, setHighlighted]);

  const results = (data?.results ?? []).filter(r => !dismissedIds.has(r.id));

  return (
    <div className="p-4 flex flex-col h-full">
      {/* Search Input */}
      <div className="flex gap-2 shrink-0 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by semantic meaning..."
            className="w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[6px] pl-4 pr-10 py-2.5 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] hover:text-[#f4f4f4] transition-colors"
              title="Clear Search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-4 py-2.5 bg-[#f4f4f4] text-[#0a0a0a] text-sm font-semibold rounded-[6px] hover:bg-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(255,255,255,0.1)]"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {isLoading && (
        <div className="text-2xs text-[#555] font-mono animate-pulse flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#f59e0b] animate-ping" />
          Traversing vector space...
        </div>
      )}

      {isError && (
        <div className="text-2xs text-[#ef4444] font-mono p-2 bg-[#ef4444]/10 rounded-[4px] border border-[#ef4444]/20">
          Search execution failed. Please check backend connection.
        </div>
      )}

      {/* Empty State */}
      {!data && !isLoading && !isError && (
        <div className="flex-1 flex flex-col items-center justify-center text-center opacity-70 px-2 mt-8">
          <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Fingerprint className="w-6 h-6 text-[#888]" />
          </div>
          <h3 className="text-sm font-medium text-[#f4f4f4] mb-2 tracking-wide">Semantic Discovery</h3>
          <p className="text-xs text-[#888] max-w-[260px] leading-relaxed">
            Find documents based on underlying meaning and contextual relationships, bypassing exact keyword limitations.
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-12 pr-1 custom-scrollbar">
        {data && !isLoading && (
          <div className="mb-6">
            <div className="text-[10px] font-mono tracking-widest text-[#555] uppercase mb-1">
              Search Latency
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-4xl font-bold font-mono text-[#06b6d4] drop-shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                {Math.round(data.latencyMs)} <span className="text-2xl text-[#06b6d4]/80">µs</span>
              </div>
            </div>
            <div className="text-[11px] font-mono text-[#555] uppercase tracking-wider mt-1">
              {algorithm.toUpperCase()} <span className="text-[#333]">·</span> {metric} <span className="text-[#333]">·</span> k={topK}
            </div>
          </div>
        )}

        {data && !isLoading && results.length > 0 && (
          <div className="text-[10px] font-mono tracking-widest text-[#555] uppercase mb-2">
            Top Matches
          </div>
        )}

        {results.map((result, idx) => {
          const catColor = CATEGORY_COLORS[result.category as keyof typeof CATEGORY_COLORS] || "#a78bfa";
          const catLabel = CATEGORY_LABELS[result.category as keyof typeof CATEGORY_LABELS] || result.category;

          return (
            <div
              key={result.id}
              onClick={() => {
                const scores = Object.fromEntries(results.map(r => [r.id, r.score]));
                setHighlighted([result.id], scores);
              }}
              className="group relative border border-[rgba(255,255,255,0.06)] bg-[#111] hover:bg-[#161616] cursor-pointer transition-colors p-4 rounded-[8px]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-[#555] tracking-widest uppercase">
                  #{idx + 1} Nearest
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm("Delete this vector from the database?")) {
                        deleteMutation.mutate(result.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-[#555] hover:text-[#ef4444] transition-all hover:bg-[#ef4444]/10 rounded-[6px] border border-transparent hover:border-[#ef4444]/20 disabled:opacity-50"
                    title="Delete from DB"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDismissedIds(prev => new Set([...prev, result.id]));
                      setHighlighted([]);
                    }}
                    className="p-1.5 text-[#555] hover:text-[#ef4444] transition-all hover:bg-[#ef4444]/10 rounded-[6px] border border-transparent hover:border-[#ef4444]/20"
                    title="Dismiss result"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Title / Snippet */}
              <p className="text-[13px] text-[#a3a3a3] font-normal leading-relaxed mb-3 line-clamp-2">
                {result.snippet}
              </p>

              <div className="flex items-center justify-between">
                <span
                  className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
                  style={{ color: catColor, borderColor: `${catColor}30`, backgroundColor: `${catColor}10` }}
                >
                  {catLabel}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#555]">Distance</span>
                  <span
                    className="font-mono text-[11px] text-[#888]"
                  >
                    {result.score.toFixed(5)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* --- SUPPLEMENTARY SECTIONS --- */}
        {data && !isLoading && (
          <div className="pt-6 space-y-10">

            {/* QUERY EMBEDDING (16D) */}
            <div className="space-y-3">
              <h4 className="text-[10px] font-mono tracking-widest text-[#555] uppercase">
                Query Embedding (16D)
              </h4>
              <div className="bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-[8px] p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent z-10 pointer-events-none" />
                <div className="flex items-end h-20 gap-1 mb-2 relative z-0">
                  {Array.from({ length: 16 }).map((_, i) => {
                    const isFocus = i < 4;
                    // Use actual query vector values if available, mapping -1.0 to 1.0 into 5% to 100% height
                    const actualValue = data.queryVector && data.queryVector.length > i
                      ? Math.abs(data.queryVector[i]) * 100
                      : 0;
                    const height = data.queryVector ? Math.max(5, Math.min(100, actualValue * 2)) : 5;
                    const opacity = isFocus ? 1 : 0.4;
                    const color = isFocus ? '#06b6d4' : (i < 8 ? '#a855f7' : (i < 12 ? '#f59e0b' : '#22c55e'));
                    return (
                      <div
                        key={i}
                        className="flex-1 rounded-t-[2px] transition-all duration-500"
                        style={{
                          height: `${height}%`,
                          backgroundColor: color,
                          opacity,
                          boxShadow: isFocus ? `0 -4px 12px ${color}40` : 'none'
                        }}
                      />
                    );
                  })}
                </div>
                {/* Embedding Labels */}
                <div className="flex justify-between text-[8px] font-mono font-bold tracking-widest text-[#555] mt-3 uppercase px-1 relative z-20">
                  <span className="w-1/4 text-center text-[#06b6d4]">CS</span>
                  <span className="w-1/4 text-center">MATH</span>
                  <span className="w-1/4 text-center">FOOD</span>
                  <span className="w-1/4 text-center">SPORT</span>
                </div>
              </div>
            </div>

            {/* Compare Algorithms Navigation Button */}
            <div className="pt-2">
              <button
                onClick={() => setActiveTab("benchmarks")}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#111] hover:bg-[#161616] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] rounded-[8px] transition-colors group"
              >
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-medium text-[#f4f4f4] uppercase tracking-wider mb-0.5">Algorithm Telemetry</span>
                  <span className="text-[10px] text-[#888]">Compare QPS and index structure</span>
                </div>
                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[#3b82f6]/20 transition-colors">
                  <ChevronRight className="w-4 h-4 text-[#555] group-hover:text-[#3b82f6]" />
                </div>
              </button>
            </div>

          </div>
        )}

        {data && results.length === 0 && (
          <div className="py-12 text-center text-[#555] text-[13px]">
            No meaningful semantic matches found.
          </div>
        )}
      </div>
    </div>
  );
}
