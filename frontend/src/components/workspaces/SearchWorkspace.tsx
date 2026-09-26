import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, FileText, Loader2, RefreshCw, Search, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { search } from "../../api/search";
import { getStatus } from "../../api/status";
import { useDocuments } from "../../hooks/useDocuments";
import { useAuthStore } from "../../store/authStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useEngineStore } from "../../store/engineStore";
import { useSessionStore } from "../../store/sessionStore";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../types/vector";
import type { SearchResult } from "../../types/search";
import { Button } from "../ui/Button";

function documentLabel(result: SearchResult, documents: { id: number; name: string }[]) {
  if (result.documentId === null) return "Manual vector";
  return documents.find((document) => document.id === result.documentId)?.name ?? `Document ${result.documentId}`;
}

export function SearchWorkspace() {
  const input = useSessionStore((s) => s.searchInputValue);
  const setInput = useSessionStore((s) => s.setSearchInputValue);
  const submittedQuery = useSessionStore((s) => s.searchQuery);
  const setSubmittedQuery = useSessionStore((s) => s.setSearchQuery);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const userId = useAuthStore((s) => s.user?.id);
  const topK = useEngineStore((s) => s.topK);
  const { data: engineStatus } = useQuery({ queryKey: ["dbStatus"], queryFn: getStatus, retry: false });
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const setQueryPoint = useCanvasStore((s) => s.setQueryPoint);
  const { data: documents = [], isSuccess: documentsLoaded } = useDocuments();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["search", userId, submittedQuery, topK, engineStatus?.engine, engineStatus?.metric],
    queryFn: () => search({ q: submittedQuery, k: topK }),
    enabled: userId !== undefined && submittedQuery.trim().length > 0,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    const selectedResult = data.results.find((result) => result.id === selectedId);
    setHighlighted(
      selectedResult ? [selectedResult.id] : data.results.map((result) => result.id),
      Object.fromEntries(data.results.map((result) => [result.id, result.distance])),
    );
    setQueryPoint(data.query2d ? { x: data.query2d[0], y: data.query2d[1] } : null);
  }, [data, selectedId, setHighlighted, setQueryPoint]);

  const selected = data?.results.find((result) => result.id === selectedId) ?? null;

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = input.trim();
    if (!nextQuery || isFetching) return;
    setSelectedId(null);
    setHighlighted([]);
    setQueryPoint(null);
    if (nextQuery === submittedQuery) void refetch();
    else setSubmittedQuery(nextQuery);
  };

  const clearSearch = () => {
    setInput("");
    setSubmittedQuery("");
    setSelectedId(null);
    setHighlighted([]);
    setQueryPoint(null);
  };

  const selectResult = (result: SearchResult) => {
    setSelectedId(result.id);
  };

  return (
    <div className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[--color-info]">Knowledge retrieval / 01</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Search across your knowledge</h2>
            <p className="mt-1 text-xs leading-relaxed text-[--text-secondary]">Describe what you need. Kernspace finds the closest indexed passages by meaning.</p>
          </div>
          <span className="rounded border border-[--border-subtle] bg-panel px-2 py-1 font-mono text-2xs text-[--text-secondary]">TOP {topK} MATCHES</span>
        </div>

        <form onSubmit={handleSearch} role="search" className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <label htmlFor="knowledge-search" className="sr-only">Search your knowledge</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-secondary]" aria-hidden="true" />
            <input id="knowledge-search" type="search" value={input} onChange={(event) => setInput(event.target.value)}
              placeholder="Describe a concept, question, or passage…"
              className="h-11 w-full min-w-0 rounded-md border border-[--border-default] bg-elevated pl-11 pr-11 text-sm text-[--text-primary] outline-none placeholder:text-[--text-tertiary] focus:border-[--color-info] focus:ring-1 focus:ring-[--color-info]" />
            {input && <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[--text-secondary] hover:bg-hover hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><X className="h-4 w-4" /></button>}
          </div>
          <Button type="submit" disabled={!input.trim() || isFetching} className="h-11 shrink-0 px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            {isFetching ? "Searching…" : "Search"}
          </Button>
        </form>

        <div aria-live="polite" className="sr-only">{isFetching ? "Searching your knowledge" : data ? `${data.count} results for ${data.query}` : ""}</div>

        {isError && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-error/20 bg-error/5 p-4">
          <div><p className="text-sm font-medium">Search could not be completed.</p><p className="mt-1 text-xs text-[--text-secondary] break-words">{error instanceof Error ? error.message : "Check the connection and try again."}</p></div>
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </div>}

        {!submittedQuery && <div className="dot-grid mt-8 grid min-h-[330px] place-items-center rounded-md border border-[--border-subtle] px-6 py-12 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-md border border-[--border-default] bg-elevated shadow-[0_0_24px_rgba(59,130,246,0.09)]"><Search className="h-5 w-5 text-[--color-info]" aria-hidden="true" /></div>
            <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[--text-secondary]">Semantic discovery</p>
            <h3 className="mt-2 text-base font-semibold">Find the passage that matters.</h3>
            <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Search with natural language, even when you do not remember the exact words in a document.</p>
            {documentsLoaded && documents.length === 0 && <button type="button" onClick={() => setActiveView("documents")} className="mt-6 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Add your first document <ArrowRight className="h-3.5 w-3.5" /></button>}
          </div>
        </div>}

        {submittedQuery && isFetching && !data && !isError && <div aria-label="Loading search results" className="mt-7 space-y-3 animate-pulse">
          {[1, 2, 3].map((index) => <div key={index} className="h-28 rounded-md border border-[--border-subtle] bg-elevated" />)}
        </div>}

        {data && !isError && <>
          <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-b border-[--border-subtle] pb-4">
            <div className="min-w-0"><p className="text-sm font-semibold">{data.count} {data.count === 1 ? "match" : "matches"}</p><p className="mt-1 max-w-full truncate text-xs text-[--text-secondary]">for “{data.query}”</p></div>
            <div className="flex items-center gap-3 font-mono text-2xs text-[--text-secondary]"><span>ROUND TRIP <span className="text-[--text-primary]">{Math.round(data.latencyMs)} ms</span></span><span className="text-[--border-strong]">/</span><span>K={topK}</span></div>
          </div>

          {data.count === 0 ? <div className="mt-6 rounded-md border border-dashed border-[--border-default] bg-panel/50 px-6 py-12 text-center">
            <h3 className="text-sm font-semibold">No matches found.</h3>
            <p className="mt-2 text-xs text-[--text-secondary]">Try a broader description or add more knowledge to search.</p>
            <button type="button" onClick={() => setActiveView("documents")} className="mt-5 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Manage documents <ArrowRight className="h-3.5 w-3.5" /></button>
          </div> : <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)]">
            <div className="min-w-0 space-y-2" aria-label="Ranked search results">
              {data.results.map((result, index) => {
                const categoryColor = CATEGORY_COLORS[result.category as keyof typeof CATEGORY_COLORS] ?? "#a78bfa";
                const categoryLabel = CATEGORY_LABELS[result.category as keyof typeof CATEGORY_LABELS] ?? result.category;
                return <button key={result.id} type="button" aria-pressed={selectedId === result.id} onClick={() => selectResult(result)}
                  className={`group w-full min-w-0 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] ${selectedId === result.id ? "border-[--color-info]/60 bg-[--color-info]/5" : "border-[--border-subtle] bg-panel hover:border-[--border-strong] hover:bg-elevated"}`}>
                  <span className="flex min-w-0 items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-2xs text-[--color-info]">{String(index + 1).padStart(2, "0")}</span><FileText className="h-3.5 w-3.5 shrink-0 text-[--text-secondary]" aria-hidden="true" /><span className="truncate text-xs font-medium text-[--text-primary]">{documentLabel(result, documents)}</span></span><span className="shrink-0 font-mono text-2xs text-[--text-secondary]">{result.distance.toFixed(4)}</span></span>
                  <span className="mt-3 block line-clamp-3 break-words text-xs leading-relaxed text-[--text-secondary]">{result.snippet}</span>
                  <span className="mt-4 flex items-center justify-between gap-2"><span className="rounded border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider" style={{ color: categoryColor, borderColor: `${categoryColor}40`, backgroundColor: `${categoryColor}12` }}>{categoryLabel}</span><span className="font-mono text-2xs text-[--text-tertiary]">DISTANCE ↓</span></span>
                </button>;
              })}
            </div>

            <aside aria-label="Search result details" className="min-w-0 self-start rounded-md border border-[--border-subtle] bg-panel p-5 lg:sticky lg:top-4">
              {selected ? <>
                <p className="font-mono text-2xs uppercase tracking-[0.18em] text-[--color-info]">Selected passage</p>
                <h3 className="mt-3 break-words text-sm font-semibold">{documentLabel(selected, documents)}</h3>
                <p className="mt-1 font-mono text-2xs text-[--text-secondary]">{selected.category} · Distance {selected.distance.toFixed(5)}</p>
                <div className="mt-5 border-t border-[--border-subtle] pt-4"><p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-[--text-secondary]">{selected.snippet}</p></div>
                <p className="mt-5 break-all border-t border-[--border-subtle] pt-3 font-mono text-2xs text-[--text-tertiary]">VECTOR {selected.id}</p>
                <button type="button" onClick={() => { openVectorLab("space"); requestAnimationFrame(() => document.getElementById("workspace")?.focus()); }} className="mt-5 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Show in Vector Lab <ArrowUpRight className="h-3.5 w-3.5" /></button>
              </> : <>
                <p className="font-mono text-2xs uppercase tracking-[0.18em] text-[--text-secondary]">Context inspector</p>
                <h3 className="mt-3 text-sm font-semibold">Select a match to inspect it.</h3>
                <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Read the full passage, identify its source, and locate its vector in the lab.</p>
                <div className="mt-6 border-t border-[--border-subtle] pt-4 font-mono text-2xs text-[--text-tertiary]">LOWER DISTANCE = CLOSER MATCH</div>
              </>}
            </aside>
          </div>}
        </>}
      </div>
    </div>
  );
}
