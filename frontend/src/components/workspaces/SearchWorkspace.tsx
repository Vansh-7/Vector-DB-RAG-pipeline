import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, FileText, Loader2, RefreshCw, Search, X } from "lucide-react";
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
import { WorkspaceHeader } from "../layout/WorkspaceHeader";

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
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      <WorkspaceHeader view="search" />
      <div className="mx-auto w-full max-w-6xl px-5 pb-8 pt-5 sm:px-7">
        <form onSubmit={handleSearch} role="search" className="flex min-w-0 flex-col gap-3 rounded-lg border border-[--border-subtle] bg-panel/60 p-3 sm:flex-row">
          <label htmlFor="knowledge-search" className="sr-only">Search your knowledge</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-secondary]" aria-hidden="true" />
            <input id="knowledge-search" type="search" value={input} onChange={(event) => setInput(event.target.value)}
              placeholder="Search your knowledge…"
              className="field h-11 pl-11 pr-11 text-body" />
            {input && <button type="button" onClick={clearSearch} aria-label="Clear search" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-[--text-secondary] hover:bg-hover hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><X className="h-4 w-4" /></button>}
          </div>
          <Button type="submit" disabled={!input.trim() || isFetching} className="h-11 shrink-0 px-5">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
            {isFetching ? "Searching…" : "Search"}
          </Button>
        </form>

        <div aria-live="polite" className="sr-only">{isFetching ? "Searching your knowledge" : data ? `${data.count} results for ${data.query}` : ""}</div>

        {isError && <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-error/20 bg-error/5 p-4">
          <div><p className="text-sm font-medium">Search could not be completed.</p><p className="mt-1 text-xs text-[--text-secondary] break-words">{error instanceof Error ? error.message : "Check the connection and try again."}</p></div>
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
        </div>}

        {!submittedQuery && <div className="mt-8 grid min-h-[330px] place-items-center px-6 py-12 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center"><Search className="h-5 w-5 text-[--text-secondary]" aria-hidden="true" /></div>
            <h3 className="text-lg font-semibold tracking-tight">Search your documents</h3>
            <p className="mt-2 text-sm leading-relaxed text-[--text-secondary]">Describe what you need, even when you don't remember the exact words.</p>
            {documentsLoaded && documents.length === 0 && <button type="button" onClick={() => setActiveView("documents")} className="mt-6 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Add your first document</button>}
          </div>
        </div>}

        {submittedQuery && isFetching && !data && !isError && <div role="status" aria-label="Loading search results" className="mt-7 space-y-3 animate-pulse">
          {[1, 2, 3].map((index) => <div key={index} className="h-28 rounded-md border border-[--border-subtle] bg-elevated" />)}
        </div>}

        {data && !isError && <>
          <div className="mt-7 mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-medium tracking-tight">Passages</h2>
            <p className="flex items-center gap-3 text-xs text-[--text-tertiary]">
              <span><span className="font-mono">{data.count}</span> {data.count === 1 ? "match" : "matches"}</span><span aria-hidden="true">·</span>
              <span title="Request round-trip time" className="font-mono">{Math.round(data.latencyMs)} ms</span><span aria-hidden="true">·</span><span className="font-mono">K={topK}</span>
            </p>
          </div>

          {data.count === 0 ? <div className="mt-6 px-6 py-12 text-center">
            <h3 className="text-sm font-semibold">No matches found.</h3>
            <p className="mt-2 text-xs text-[--text-secondary]">Try a broader description or add more knowledge to search.</p>
            <button type="button" onClick={() => setActiveView("documents")} className="mt-5 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Manage documents</button>
          </div> : <div className={`mt-2 grid min-w-0 gap-6 ${selected ? "lg:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
            <div className="min-w-0 space-y-2.5" aria-label="Ranked search results">
              {data.results.map((result, index) => {
                const categoryColor = CATEGORY_COLORS[result.category as keyof typeof CATEGORY_COLORS] ?? "var(--color-tech)";
                const categoryLabel = CATEGORY_LABELS[result.category as keyof typeof CATEGORY_LABELS] ?? result.category;
                return <button key={result.id} type="button" aria-pressed={selectedId === result.id} onClick={(event) => { selectedTriggerRef.current = event.currentTarget; selectResult(result); }}
                  className={`group w-full min-w-0 rounded-md border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] ${selectedId === result.id ? "border-[--border-strong] bg-elevated" : "border-[--border-subtle] bg-panel/50 hover:border-[--border-default] hover:bg-panel"}`}>
                  <span className="flex min-w-0 items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-2"><span className="shrink-0 font-mono text-xs text-[--text-tertiary]">{String(index + 1).padStart(2, "0")}</span><FileText className="h-4 w-4 shrink-0 text-[--text-secondary]" aria-hidden="true" /><span className="truncate text-body font-medium text-[--text-primary]" title={documentLabel(result, documents)}>{documentLabel(result, documents)}</span></span><span title="Distance: lower is closer" className="shrink-0 font-mono text-xs text-[--text-secondary]">{result.distance.toFixed(4)}</span></span>
                  <span className="mt-3 ml-7 block line-clamp-3 break-words text-body leading-[1.7] text-[--text-secondary]">{result.snippet}</span>
                  <span className="mt-3 ml-7 flex flex-wrap items-center gap-3 text-2xs text-[--text-tertiary]"><span className="rounded border border-[--border-subtle] bg-elevated/60 px-1.5 py-0.5" style={{ color: categoryColor }}>{categoryLabel}</span><span className="font-mono">{result.id}</span></span>
                </button>;
              })}
            </div>

            {selected && <aside aria-label="Search result details" className="min-w-0 self-start rounded-lg border border-[--border-subtle] bg-panel p-5 lg:sticky lg:top-4">
                <div className="flex items-center justify-between gap-2"><p className="text-xs text-[--text-secondary]">Selected passage</p><button type="button" aria-label="Close search inspector" className="icon-button h-7 w-7" onClick={() => { setSelectedId(null); requestAnimationFrame(() => selectedTriggerRef.current?.focus()); }}><X className="h-4 w-4" /></button></div>
                <h3 className="mt-3 break-words text-md font-medium leading-relaxed">{documentLabel(selected, documents)}</h3>
                <p className="mt-2 text-xs text-[--text-tertiary]">{CATEGORY_LABELS[selected.category as keyof typeof CATEGORY_LABELS] ?? selected.category} · Distance <span className="font-mono">{selected.distance.toFixed(5)}</span></p>
                <div className="mt-5 border-t border-[--border-subtle] pt-4"><p className="whitespace-pre-wrap break-words text-body leading-[1.75] text-[--text-secondary]">{selected.snippet}</p></div>
                <p className="mt-5 break-all border-t border-[--border-subtle] pt-3 text-xs text-[--text-tertiary]">Vector <span className="font-mono">{selected.id}</span></p>
                <Button type="button" variant="outline" onClick={() => { openVectorLab("space"); requestAnimationFrame(() => document.getElementById("workspace")?.focus()); }} className="mt-5">Show in Vector Lab <ArrowUpRight className="h-3.5 w-3.5" /></Button>
            </aside>}
          </div>}
        </>}
      </div>
    </div>
  );
}
