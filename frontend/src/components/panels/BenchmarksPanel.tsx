import { useState, type FormEvent } from "react";
import { Activity, ArrowRight, Layers3, Loader2, RefreshCw, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getBenchmarks } from "../../api/benchmark";
import { getStatus } from "../../api/status";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore } from "../../store/sessionStore";
import { formatNumber } from "../../lib/utils";
import { Button } from "../ui/Button";

export function BenchmarksPanel() {
  const userId = useAuthStore((s) => s.user?.id);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const [draftQuery, setDraftQuery] = useState("");
  const [benchmarkQuery, setBenchmarkQuery] = useState("");
  const { data: status } = useQuery({ queryKey: ["dbStatus"], queryFn: getStatus, retry: false });
  const { data, isPending, isFetching, isError, error, refetch } = useQuery({
    queryKey: ["benchmarks", userId, benchmarkQuery, status?.engine, status?.metric],
    queryFn: () => getBenchmarks(benchmarkQuery || undefined),
    enabled: userId !== undefined,
    retry: false,
    staleTime: 30_000,
  });
  const algorithms = data?.algorithms ?? [];
  const maxQps = Math.max(1, ...algorithms.map((algorithm) => algorithm.throughputQps));
  const active = algorithms.find((algorithm) => algorithm.isActive);
  const noVectors = !!data && algorithms.every((algorithm) => algorithm.latencyMs === 0 && algorithm.throughputQps === 0);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isFetching) return;
    const next = draftQuery.trim();
    if (next === benchmarkQuery) void refetch();
    else setBenchmarkQuery(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[--color-info]">Telemetry / 03</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Algorithm benchmarks</h2>
          <p className="mt-1 text-xs leading-relaxed text-[--text-secondary]">Compare HNSW, KD-tree, and exact search on your indexed vectors.</p>
        </div>
        <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded px-2 py-1.5 text-xs text-[--text-secondary] hover:bg-hover hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Refresh telemetry
        </button>
      </div>

      <form onSubmit={submit} className="flex min-w-0 flex-col gap-2 rounded-md border border-[--border-subtle] bg-panel p-4 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs text-[--text-secondary]">Optional benchmark query
          <span className="mt-1 block text-2xs">Leave blank to use one of your indexed vectors as the test query.</span>
          <span className="relative mt-2 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-tertiary]" />
            <input value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="A concept to embed and benchmark"
              className="h-10 w-full min-w-0 rounded-[4px] border border-[--border-default] bg-elevated pl-10 pr-3 text-sm text-[--text-primary] outline-none placeholder:text-[--text-tertiary] focus:border-[--color-info]" />
          </span>
        </label>
        <Button type="submit" disabled={isFetching} className="h-10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          {isFetching ? "Running…" : "Run benchmark"}
        </Button>
      </form>

      {isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-error/20 bg-error/5 p-4">
        <div><p className="text-sm font-medium">Benchmark could not be completed.</p><p className="mt-1 text-xs text-[--text-secondary] break-words">{error instanceof Error ? error.message : "Check the connection and try again."}</p></div>
        <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
      </div>}

      {isPending && !isError && <div aria-label="Loading benchmark telemetry" className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((index) => <div key={index} className="h-44 animate-pulse rounded-md border border-[--border-subtle] bg-elevated" />)}
      </div>}

      {noVectors && <div className="rounded-md border border-dashed border-[--border-default] bg-panel/50 px-6 py-10 text-center">
        <h3 className="text-sm font-semibold">No searchable vectors to benchmark.</h3>
        <p className="mt-2 text-xs text-[--text-secondary]">Add a document or inject a vector, then run the comparison.</p>
        <button type="button" onClick={() => setActiveView("documents")} className="mt-5 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Open Documents <ArrowRight className="h-3.5 w-3.5" /></button>
      </div>}

      {data && !noVectors && <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[--border-subtle] pb-3">
          <p className="font-mono text-2xs uppercase tracking-[0.16em] text-[--text-secondary]">Synthetic in-memory run · five searches · up to 5,000 vectors</p>
          <p className="font-mono text-2xs text-[--text-tertiary]">{active ? `ACTIVE ${active.displayName.toUpperCase()}` : "NO ACTIVE ENGINE"}</p>
        </div>
        <div className="grid min-w-0 gap-3 md:grid-cols-3">
          {algorithms.map((algorithm, index) => (
            <article key={algorithm.name} className={`min-w-0 rounded-md border bg-panel p-4 sm:p-5 ${algorithm.isActive ? "border-[--color-info]/50 shadow-[0_0_24px_rgba(59,130,246,0.06)]" : "border-[--border-subtle]"}`}>
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-2xs text-[--text-tertiary]">{String(index + 1).padStart(2, "0")} / ALGORITHM</span>{algorithm.isActive && <span className="rounded border border-[--color-info]/30 bg-[--color-info]/10 px-1.5 py-0.5 font-mono text-2xs text-[--color-info]">ACTIVE</span>}</div>
              <h3 className="mt-4 min-h-10 text-sm font-semibold leading-tight">{algorithm.displayName}</h3>
              <div className="mt-4 border-t border-[--border-subtle] pt-4">
                <p className="font-mono text-2xs uppercase tracking-wider text-[--text-tertiary]">Query latency</p>
                <p className="mt-1 font-mono text-2xl text-[--text-primary]">{algorithm.latencyMs.toFixed(2)}<span className="ml-1 text-xs text-[--text-secondary]">ms</span></p>
              </div>
              <div className="mt-4"><p className="font-mono text-2xs uppercase tracking-wider text-[--text-tertiary]">Estimated throughput</p><p className="mt-1 font-mono text-sm text-[--text-secondary]">{formatNumber(Math.round(algorithm.throughputQps))} QPS</p></div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-elevated"><div className={`h-full rounded-full ${algorithm.isActive ? "bg-[--color-info]" : "bg-success"}`} style={{ width: `${Math.max(2, algorithm.throughputQps / maxQps * 100)}%` }} /></div>
            </article>
          ))}
        </div>

        <section aria-label="HNSW topology" className="rounded-md border border-[--border-subtle] bg-panel p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.16em] text-[--text-secondary]"><Layers3 className="h-3.5 w-3.5" /> Index topology</p><h3 className="mt-2 text-sm font-semibold">HNSW layers</h3></div><span className={`rounded border px-2 py-1 font-mono text-2xs ${active?.name === "hnsw" ? "border-[--color-info]/30 text-[--color-info]" : "border-[--border-default] text-[--text-secondary]"}`}>{active?.name === "hnsw" ? "ACTIVE" : "INACTIVE"}</span></div>
          {data.topology?.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {data.topology.map((layer) => <div key={layer.level} className="rounded border border-[--border-subtle] bg-elevated p-4">
              <div className="flex items-center justify-between"><span className="text-xs font-medium">{layer.level === 0 ? "Base layer" : "Navigable layer"}</span><span className="font-mono text-2xs text-[--color-info]">L{layer.level}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs"><div><p className="text-2xs text-[--text-tertiary]">NODES</p><p className="mt-1 text-[--color-tech]">{formatNumber(layer.nodes)}</p></div><div><p className="text-2xs text-[--text-tertiary]">EDGES</p><p className="mt-1 text-[--text-primary]">{formatNumber(layer.edges)}</p></div></div>
            </div>)}
          </div> : <div className="mt-5 rounded border border-dashed border-[--border-default] p-5"><p className="text-xs text-[--text-secondary]">{active?.name === "hnsw" ? "No topology was produced for this run." : "Topology is available when HNSW is the active engine."}</p>{active?.name !== "hnsw" && <button type="button" onClick={() => openVectorLab("engine")} className="mt-3 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Open Engine <ArrowRight className="h-3.5 w-3.5" /></button>}</div>}
          <p className="mt-4 text-2xs leading-relaxed text-[--text-tertiary]">Topology is measured from the benchmark HNSW build over your searchable vectors; it is not a live graph view of the shared index.</p>
        </section>
      </div>}
    </div>
  );
}
