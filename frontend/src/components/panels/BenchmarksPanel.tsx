import { useState, type CSSProperties, type FormEvent } from "react";
import { Activity, ArrowUpRight, Loader2, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getBenchmarks } from "../../api/benchmark";
import { getStatus } from "../../api/status";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore } from "../../store/sessionStore";
import { formatNumber } from "../../lib/utils";
import { Button } from "../ui/Button";
import type { AlgorithmBenchmark } from "../../types/benchmark";

function algorithmLabel(algorithm: AlgorithmBenchmark) {
  const labels: Record<string, string> = { hnsw: "HNSW", kdtree: "KD-tree", exact: "Exact search" };
  return labels[algorithm.name] ?? algorithm.displayName;
}

function algorithmAccent(name: string): CSSProperties {
  const channels: Record<string, string> = {
    hnsw: "--color-tech-rgb", kdtree: "--color-finance-rgb", exact: "--color-info-rgb",
  };
  const channel = channels[name] ?? "--color-info-rgb";
  return {
    "--benchmark-accent": `rgb(var(${channel}) / .65)`,
    "--benchmark-accent-soft": `rgb(var(${channel}) / .08)`,
  } as CSSProperties;
}

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
  const maxThroughput = Math.max(0, ...algorithms.map((algorithm) => algorithm.throughputQps));
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
      <div>
        <h2 className="text-md font-semibold">Compare search algorithms</h2>
        <p className="mt-1 text-xs leading-relaxed text-[--text-secondary]">Run the same query through HNSW, KD-tree, and exact search.</p>
      </div>

      <form onSubmit={submit} className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label htmlFor="benchmark-query" className="text-xs text-[--text-secondary]">Test query</label>
          <p id="benchmark-query-help" className="mt-1 text-2xs text-[--text-secondary]">Enter a query, or leave blank to use one of your indexed vectors.</p>
          <div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-tertiary]" aria-hidden="true" />
            <input id="benchmark-query" aria-describedby="benchmark-query-help" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} placeholder="e.g. How does retrieval work?"
              className="field h-10 w-full min-w-0 pl-10 pr-3 text-sm" />
          </div>
        </div>
        <Button type="submit" disabled={isFetching} className="h-10 shrink-0 sm:w-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Activity className="h-3.5 w-3.5" aria-hidden="true" />}
          {isFetching ? "Running…" : data ? "Run again" : "Run comparison"}
        </Button>
      </form>
      <p className="!mt-3 text-2xs text-[--text-secondary]">5 searches per algorithm · up to 5,000 vectors · in memory</p>

      {isError && <div role="alert" className="rounded-md border border-error/20 bg-error/5 p-4">
        <p className="text-sm font-medium">Benchmark could not be completed.</p><p className="mt-1 text-xs text-[--text-secondary] break-words">{error instanceof Error ? error.message : "Check the connection and try again."}</p>
      </div>}

      {isPending && !isError && <div role="status" aria-label="Running comparison" className="grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((index) => <div key={index} className="h-60 animate-pulse rounded-md border border-[--border-default] bg-[--composer-surface]" />)}
      </div>}

      {noVectors && <div className="px-6 py-10 text-center">
        <h3 className="text-sm font-semibold">No searchable vectors to benchmark.</h3>
        <p className="mt-2 text-xs text-[--text-secondary]">Add a document or inject a vector, then run the comparison.</p>
        <button type="button" onClick={() => setActiveView("documents")} className="mt-5 inline-flex items-center gap-2 text-xs text-[--color-info] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Open Documents</button>
      </div>}

      {data && !noVectors && <div className="space-y-6">
        <p role="status" className="sr-only">{isFetching ? "Running comparison…" : isError ? "Showing previous comparison results." : "Comparison complete."}</p>
        <div aria-label="Algorithm comparison results" className="grid min-w-0 gap-3 md:grid-cols-3">
          {algorithms.map((algorithm) => (
            <article key={algorithm.name} aria-label={algorithmLabel(algorithm)} style={algorithmAccent(algorithm.name)} className="min-w-0 rounded-md border border-[--border-default] bg-[--composer-surface] p-4 sm:p-5">
              <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-medium"><span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-[--benchmark-accent]" />{algorithmLabel(algorithm)}</h3>
                {algorithm.isActive && <span className="rounded border border-[--border-default] bg-[--benchmark-accent-soft] px-1.5 py-0.5 text-2xs text-[--text-secondary]">Current index</span>}
              </div>
              <dl className="mt-3 space-y-4 border-t border-[--border-subtle] pt-4">
                <div><dt className="text-xs text-[--text-secondary]">Avg. latency</dt><dd className="mt-1 font-mono text-[28px] leading-9 tabular-nums text-[--text-primary]">{algorithm.latencyMs.toFixed(2)}<span className="ml-1.5 text-xs text-[--text-secondary]">ms</span></dd></div>
                <div><dt className="text-xs text-[--text-secondary]">Est. throughput</dt><dd className="mt-1 font-mono text-sm tabular-nums text-[--text-primary]">{formatNumber(Math.round(algorithm.throughputQps))}<span className="ml-1 text-xs text-[--text-secondary]">q/s</span></dd></div>
              </dl>
              <div aria-hidden="true" className="mt-4 h-1 overflow-hidden rounded-full bg-[--border-subtle]">
                <div className="h-full rounded-full bg-[--benchmark-accent]" style={{ width: `${maxThroughput > 0 ? Math.max(0, algorithm.throughputQps) / maxThroughput * 100 : 0}%` }} />
              </div>
            </article>
          ))}
        </div>

        <section aria-label="HNSW topology" className="border-t border-[--border-subtle] pt-5">
          <h3 className="text-sm font-medium">HNSW topology</h3>
          <p className="mt-1 text-xs text-[--text-secondary]">Structure of the benchmark index.</p>
          {data.topology?.length ? <div className="mt-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))" }}>
            {[...data.topology].sort((a, b) => b.level - a.level).map((layer) => <article key={layer.level} aria-label={`HNSW layer L${layer.level}`} className="min-w-0 rounded-lg border border-[--border-default] bg-panel p-4 sm:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-xs font-medium">{layer.level === 0 ? "Base layer" : "Navigable layer"}</h4>
                <span className="font-mono text-xs text-[--color-tech]">L{layer.level}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div><dt className="text-xs text-[--text-tertiary]">Nodes</dt><dd className="mt-1 font-mono text-sm tabular-nums text-[--text-primary]">{formatNumber(layer.nodes)}</dd></div>
                <div><dt className="text-xs text-[--text-tertiary]">Edges</dt><dd className="mt-1 font-mono text-sm tabular-nums text-[--text-primary]">{formatNumber(layer.edges)}</dd></div>
              </dl>
            </article>)}
          </div> : <p className="mt-4 text-xs text-[--text-secondary]">{active?.name === "hnsw" ? "No topology was produced for this comparison." : "Topology is returned when HNSW is the current index."}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
            {data.topology?.length ? <p className="text-2xs text-[--text-secondary]">Built for this comparison from your searchable vectors.</p> : <span />}
            <Button type="button" variant="ghost" onClick={() => openVectorLab("space")} className="!h-8 !px-0 text-xs text-[--color-info]">Open Vector Space <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
          </div>
        </section>
      </div>}
    </div>
  );
}
