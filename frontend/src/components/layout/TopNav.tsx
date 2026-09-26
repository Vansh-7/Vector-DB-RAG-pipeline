import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../../api/status";
import { useEngineStore } from "../../store/engineStore";

export function TopNav() {
  const modelName = useEngineStore((s) => s.modelName);
  // Shares DataLoader's status query; no separate polling loop.
  const { data, isError, isPending } = useQuery({
    queryKey: ["dbStatus"], queryFn: getStatus, retry: false,
  });
  const apiLabel = isError ? "Offline" : isPending ? "Connecting" : "Online";
  const apiColor = isError ? "bg-error" : isPending ? "bg-warning" : "bg-success";

  return (
    <header className="min-h-14 bg-panel border-b border-[--border-subtle] flex items-center justify-between gap-4 px-4 py-2 shrink-0 min-w-0">
      <div className="flex items-center gap-2.5 shrink-0" aria-label="Kernspace">
        <img src="/favicon.svg" alt="" aria-hidden="true" className="w-7 h-7 drop-shadow-[0_0_8px_rgba(59,130,246,0.2)]" />
        <span className="font-brand font-bold text-sm tracking-[0.2em]">KERNSPACE</span>
      </div>
      <div aria-label="Service status" className="flex flex-wrap justify-end items-center gap-x-4 gap-y-1 font-mono text-2xs text-[#888] min-w-0">
        <span className="flex items-center gap-1.5" role="status">
          <span className={`w-1.5 h-1.5 rounded-full ${apiColor}`} aria-hidden="true" />
          API <span className="text-[#f4f4f4]">{apiLabel}</span>
        </span>
        <span className="hidden sm:inline" title={data && !isError ? `Shared ${data.engine.toUpperCase()} index · ${data.metric}` : "Index status unavailable"}>
          Shared index: <span className="text-[#f4f4f4]">{data && !isError ? `${data.total_docs.toLocaleString()} vectors` : "—"}</span>
        </span>
        <span className="hidden md:inline" title={`${modelName} · Inference health is not reported by the API`}>
          LLM: <span className="text-[#888]">Not checked</span>
        </span>
      </div>
    </header>
  );
}
