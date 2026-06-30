import { useState } from "react";
import { Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { search } from "../../api/search";
import { useEngineStore } from "../../store/engineStore";
import { useCanvasStore } from "../../store/canvasStore";
import { getScoreColor } from "../../lib/utils";
import { CATEGORY_COLORS } from "../../types/vector";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const algorithm = useEngineStore((s) => s.algorithm);
  const metric = useEngineStore((s) => s.metric);
  const topK = useEngineStore((s) => s.topK);
  const category = useEngineStore((s) => s.category);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);

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
  });

  const handleSearch = () => {
    if (query.trim()) {
      setSearchQuery(query.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const results = data?.results ?? [];

  return (
    <div className="p-4 space-y-3 flex flex-col h-full">
      <div className="flex gap-2 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search vector database..."
          className="flex-1 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !query.trim()}
          className="px-3 py-2 bg-white text-black text-sm font-medium rounded-[4px] hover:bg-[#e5e5e5] transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search className="w-3.5 h-3.5" />
          Search
        </button>
      </div>

      {isLoading && (
        <div className="text-2xs text-[#555] font-mono animate-pulse">
          Searching vector space...
        </div>
      )}

      {isError && (
        <div className="text-2xs text-[#ef4444] font-mono">
          Failed to execute search.
        </div>
      )}

      {data && !isLoading && (
        <div className="text-2xs text-[#555] font-mono shrink-0">
          Found top {results.length} results in {data.latencyMs.toFixed(1)}ms
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-0">
        {results.map((result) => (
          <div
            key={result.id}
            onClick={() => setHighlighted([result.id])}
            className="border-b border-[rgba(255,255,255,0.06)] py-3 hover:bg-[#161616] cursor-pointer transition-colors px-1 -mx-1 rounded-[3px]"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="font-mono text-xs font-medium"
                style={{ color: CATEGORY_COLORS[result.category] }}
              >
                {result.id}
              </span>
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: getScoreColor(result.score) }}
              >
                {result.score.toFixed(3)}
              </span>
            </div>
            <p className="text-sm text-[#888] leading-relaxed line-clamp-3">
              {result.snippet}
            </p>
          </div>
        ))}
        {data && results.length === 0 && (
          <div className="py-8 text-center text-[#555] text-sm">
            No vectors matched the query
          </div>
        )}
      </div>
    </div>
  );
}
