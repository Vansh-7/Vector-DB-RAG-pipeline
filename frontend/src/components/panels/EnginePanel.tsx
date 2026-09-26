import { useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Check, DatabaseZap, Loader2, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configureEngine } from "../../api/engine";
import { getStatus, type DbStatusResponse } from "../../api/status";
import { insertVector } from "../../api/vectors";
import { getCurrentTimestamp } from "../../lib/utils";
import { useEngineStore } from "../../store/engineStore";
import { useTerminalStore } from "../../store/terminalStore";
import {
  ALGORITHM_DISPLAY,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  METRIC_DISPLAY,
  type Algorithm,
  type Category,
  type DistanceMetric,
} from "../../types/vector";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Slider } from "../ui/Slider";

const algorithmOptions = Object.entries(ALGORITHM_DISPLAY).map(([value, label]) => ({ value, label }));
const metricOptions = Object.entries(METRIC_DISPLAY).map(([value, label]) => ({ value, label }));
const categoryOptions = CATEGORY_ORDER.filter((category) => category !== "DOCUMENTS")
  .map((category) => ({ value: category, label: CATEGORY_LABELS[category] }));

export function EnginePanel() {
  const queryClient = useQueryClient();
  const addLog = useTerminalStore((s) => s.addLog);
  const topK = useEngineStore((s) => s.topK);
  const setTopK = useEngineStore((s) => s.setTopK);
  const category = useEngineStore((s) => s.category);
  const setCategory = useEngineStore((s) => s.setCategory);
  const [draftAlgorithm, setDraftAlgorithm] = useState<Algorithm>("hnsw");
  const [draftMetric, setDraftMetric] = useState<DistanceMetric>("cosine");
  const [payload, setPayload] = useState("");
  const { data: status, isPending: statusPending, isError: statusError, refetch: refreshStatus } = useQuery({
    queryKey: ["dbStatus"],
    queryFn: getStatus,
    retry: false,
  });

  const configure = useMutation({
    mutationFn: ({ algorithm, metric }: { algorithm: Algorithm; metric: DistanceMetric }) =>
      configureEngine(algorithm, metric),
    onMutate: ({ algorithm, metric }) => {
      addLog({ timestamp: getCurrentTimestamp(), level: "INFO", message: `Reconfiguring shared index to ${algorithm}/${metric}…` });
    },
    onSuccess: (result) => {
      queryClient.setQueryData<DbStatusResponse>(["dbStatus"], {
        engine: result.algorithm,
        metric: result.metric,
        total_docs: result.total_docs,
      });
      for (const key of ["dbStatus", "vectorSample", "benchmarks", "search"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      addLog({ timestamp: getCurrentTimestamp(), level: "SUCCESS", message: `Shared index configured as ${result.algorithm}/${result.metric}.` });
    },
    onError: (error) => {
      addLog({ timestamp: getCurrentTimestamp(), level: "ERROR", message: `Engine configuration failed: ${error.message}` });
    },
  });

  useEffect(() => {
    if (!status || configure.isPending) return;
    setDraftAlgorithm(status.engine);
    setDraftMetric(status.metric);
  }, [status, configure.isPending]);

  const inject = useMutation({
    mutationFn: () => insertVector({ category, payload: payload.trim() }),
    onSuccess: () => {
      setPayload("");
      for (const key of ["dbStatus", "vectorSample", "benchmarks", "search"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });

  const submitConfiguration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!status || configure.isPending) return;
    configure.mutate({ algorithm: draftAlgorithm, metric: draftMetric });
  };
  const changed = !!status && (draftAlgorithm !== status.engine || draftMetric !== status.metric);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[--color-info]">Index control / 02</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Engine & injection</h2>
        <p className="mt-1 text-xs leading-relaxed text-[--text-secondary]">Tune retrieval and work directly with the custom vector index.</p>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <div className="min-w-0 rounded-md border border-[--border-subtle] bg-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-mono text-2xs uppercase tracking-[0.16em] text-[--text-secondary]">Shared index</p><h3 className="mt-2 text-sm font-semibold">Engine configuration</h3></div>
            <button type="button" onClick={() => void refreshStatus()} aria-label="Refresh engine status"
              className="rounded p-2 text-[--text-secondary] hover:bg-hover hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><RefreshCw className="h-4 w-4" /></button>
          </div>
          {statusPending && <p role="status" className="mt-5 flex items-center gap-2 text-xs text-[--text-secondary]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading current configuration…</p>}
          {statusError && <div role="alert" className="mt-5 rounded border border-error/20 bg-error/5 p-3 text-xs"><p>Engine status is unavailable.</p><button type="button" onClick={() => void refreshStatus()} className="mt-2 text-[--color-info] hover:text-white">Retry</button></div>}
          {status && !statusError && <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded border border-[--border-subtle] bg-elevated p-3"><p className="font-mono text-2xs uppercase tracking-wider text-[--text-tertiary]">Active index</p><p className="mt-2 truncate text-xs font-medium" title={ALGORITHM_DISPLAY[status.engine]}>{ALGORITHM_DISPLAY[status.engine]}</p></div>
            <div className="min-w-0 rounded border border-[--border-subtle] bg-elevated p-3"><p className="font-mono text-2xs uppercase tracking-wider text-[--text-tertiary]">Distance</p><p className="mt-2 truncate text-xs font-medium" title={METRIC_DISPLAY[status.metric]}>{METRIC_DISPLAY[status.metric]}</p></div>
          </div>}
          <form onSubmit={submitConfiguration} className="mt-5 space-y-4">
            <div><p className="mb-2 font-mono text-2xs uppercase tracking-wider text-[--text-secondary]">Index algorithm</p><Select ariaLabel="Index algorithm" value={draftAlgorithm} onValueChange={(value) => setDraftAlgorithm(value as Algorithm)} options={algorithmOptions} disabled={!status || configure.isPending} /></div>
            <div><p className="mb-2 font-mono text-2xs uppercase tracking-wider text-[--text-secondary]">Distance metric</p><Select ariaLabel="Distance metric" value={draftMetric} onValueChange={(value) => setDraftMetric(value as DistanceMetric)} options={metricOptions} disabled={!status || configure.isPending} /></div>
            <div className="border-t border-[--border-subtle] pt-4">
              <div className="mb-2 flex items-center justify-between"><p className="font-mono text-2xs uppercase tracking-wider text-[--text-secondary]">Top K retrieval</p><span className="font-mono text-sm">{topK}</span></div>
              <Slider ariaLabel="Top K retrieval" value={topK} onValueChange={setTopK} min={1} max={20} />
              <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Your local result limit for Search and Chat. Range 1–20.</p>
            </div>
            <div className="rounded border border-warning/20 bg-warning/5 p-3 text-xs leading-relaxed text-[--text-secondary]"><AlertTriangle className="mr-2 inline h-3.5 w-3.5 text-warning" aria-hidden="true" />Applying an algorithm or metric rebuilds the shared index for all users.</div>
            {configure.isError && <p role="alert" className="text-xs text-error break-words">{configure.error.message}</p>}
            {configure.isSuccess && !changed && <p role="status" className="flex items-center gap-2 text-xs text-success"><Check className="h-3.5 w-3.5" /> Engine configuration applied.</p>}
            <Button type="submit" disabled={!changed || configure.isPending || statusError} className="h-9 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
              {configure.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {configure.isPending ? "Applying…" : "Apply configuration"}
            </Button>
          </form>
        </div>

        <div className="min-w-0 self-start rounded-md border border-[--border-subtle] bg-panel p-5 sm:p-6">
          <div className="flex items-center gap-2"><DatabaseZap className="h-4 w-4 text-[--color-info]" aria-hidden="true" /><p className="font-mono text-2xs uppercase tracking-[0.16em] text-[--text-secondary]">Advanced operation</p></div>
          <h3 className="mt-3 text-sm font-semibold">Manual vector injection</h3>
          <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Embed a text payload directly into your vector index. For document ingestion, use Documents.</p>
          <div className="mt-5 space-y-4">
            <div><p className="mb-2 font-mono text-2xs uppercase tracking-wider text-[--text-secondary]">Category</p><Select ariaLabel="Vector category" value={category} onValueChange={(value) => setCategory(value as Category)} options={categoryOptions} disabled={inject.isPending} /></div>
            <label className="block text-xs text-[--text-secondary]">Payload
              <textarea value={payload} onChange={(event) => setPayload(event.target.value)} placeholder="Text to embed and index…"
                className="mt-2 min-h-32 w-full resize-y rounded-[4px] border border-[--border-default] bg-elevated p-3 font-mono text-xs leading-relaxed text-[--text-primary] outline-none placeholder:text-[--text-tertiary] focus:border-[--color-info]" />
            </label>
            {inject.isError && <p role="alert" className="text-xs text-error break-words">{inject.error.message}</p>}
            {inject.isSuccess && <p role="status" className="flex items-center gap-2 text-xs text-success"><Check className="h-3.5 w-3.5" /> Vector added to your index.</p>}
            <Button type="button" onClick={() => inject.mutate()} disabled={!payload.trim() || inject.isPending} className="h-9 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
              {inject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {inject.isPending ? "Embedding…" : "Inject vector"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
