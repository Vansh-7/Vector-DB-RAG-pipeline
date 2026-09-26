import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, X } from "lucide-react";
import { useDocuments } from "../../hooks/useDocuments";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import type { RAGSource } from "../../types/rag";

export function SourcesInspector({ sources, onClose }: { sources: RAGSource[]; onClose: (restoreFocus?: boolean) => void }) {
  const documents = useDocuments().data ?? [];
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const [selected, setSelected] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const current = sources[selected] ?? sources[0];
  const documentName = documents.find((document) => document.id === current?.documentId)?.name;

  useEffect(() => {
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [onClose]);

  if (!current) return null;

  return (
    <aside aria-label="Answer sources" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[360px] min-w-0 flex-col border-l border-[--border-default] bg-panel shadow-[-16px_0_60px_rgba(0,0,0,0.5)]">
      <div className="flex items-start justify-between gap-3 border-b border-[--border-subtle] px-5 py-4">
        <div><h2 className="text-sm font-semibold">Answer sources</h2><p className="mt-1 text-xs text-[--text-secondary]">{sources.length} retrieved {sources.length === 1 ? "chunk" : "chunks"}</p></div>
        <button ref={closeRef} type="button" onClick={() => onClose()} aria-label="Close sources" className="rounded p-1.5 text-[--text-secondary] hover:bg-hover hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><X className="h-4 w-4" /></button>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {sources.map((source, index) => {
            const name = documents.find((document) => document.id === source.documentId)?.name;
            return <button key={`${source.vectorId}-${index}`} type="button" onClick={() => { setSelected(index); setHighlighted([source.vectorId], { [source.vectorId]: source.score }); }}
              aria-current={selected === index ? "true" : undefined}
              className={`w-full min-w-0 rounded-[4px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] ${selected === index ? "border-[--color-info]/50 bg-[--color-info]/5" : "border-[--border-subtle] bg-elevated hover:border-[--border-strong]"}`}>
              <span className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-xs font-medium"><FileText className="h-3.5 w-3.5 shrink-0 text-[--color-info]" aria-hidden="true" /><span className="truncate">{name ?? `Source ${index + 1}`}</span></span><span className="shrink-0 font-mono text-[10px] text-success">{source.score.toFixed(3)}</span></span>
              <span className="mt-2 block line-clamp-2 text-xs leading-relaxed text-[--text-secondary]">{source.snippet}</span>
            </button>;
          })}
        </div>
        <div className="mt-6 border-t border-[--border-subtle] pt-5">
          <p className="text-xs font-medium text-[--text-primary]">{documentName ?? "Retrieved context"}</p>
          <p className="mt-1 font-mono text-[10px] text-[--text-secondary]">{current.category} · Score {current.score.toFixed(3)}</p>
          <p className="mt-4 whitespace-pre-wrap break-words text-xs leading-relaxed text-[--text-secondary]">{current.snippet}</p>
          <div className="mt-5 border-t border-[--border-subtle] pt-3 font-mono text-[10px] text-[--text-tertiary] break-all">Vector {current.vectorId}{current.documentId != null ? ` · Document ${current.documentId}` : ""}</div>
          <button type="button" onClick={() => { setHighlighted([current.vectorId], { [current.vectorId]: current.score }); openVectorLab("space"); onClose(false); requestAnimationFrame(() => document.getElementById("workspace")?.focus()); }} className="mt-5 flex items-center gap-1.5 text-xs text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Show in Vector Lab <ArrowUpRight className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </aside>
  );
}
