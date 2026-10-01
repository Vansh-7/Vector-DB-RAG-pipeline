import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, FileText, X } from "lucide-react";
import { useDocuments } from "../../hooks/useDocuments";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import type { RAGSource } from "../../types/rag";
import { CATEGORY_LABELS } from "../../types/vector";
import { Button } from "../ui/Button";

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
    <aside aria-label="Answer sources" className="absolute inset-y-0 right-0 z-20 flex w-full max-w-[360px] min-w-0 flex-col border-l border-[--border-default] bg-panel shadow-[-12px_0_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-start justify-between gap-3 border-b border-[--border-subtle] px-5 py-4">
        <div><h2 className="text-md font-medium">Answer sources</h2><p className="mt-1 text-xs text-[--text-tertiary]"><span className="font-mono">{sources.length}</span> retrieved {sources.length === 1 ? "chunk" : "chunks"}</p></div>
        <button ref={closeRef} type="button" onClick={() => onClose()} aria-label="Close sources" className="icon-button"><X className="h-4 w-4" /></button>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-2.5">
          {sources.map((source, index) => {
            const name = documents.find((document) => document.id === source.documentId)?.name;
            return <button key={`${source.vectorId}-${index}`} type="button" onClick={() => { setSelected(index); setHighlighted([source.vectorId], { [source.vectorId]: source.score }); }}
              aria-current={selected === index ? "true" : undefined}
              className={`w-full min-w-0 rounded-md border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] ${selected === index ? "border-[--border-strong] bg-elevated shadow-sm" : "border-[--border-subtle] hover:border-[--border-default] hover:bg-elevated/60"}`}>
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium"><FileText className="h-4 w-4 shrink-0 text-[--text-secondary]" aria-hidden="true" /><span className="truncate" title={name}>{name ?? `Source ${index + 1}`}</span></span>
              <span className="mt-2 block line-clamp-2 text-sm leading-relaxed text-[--text-secondary]">{source.snippet}</span>
              <span className="mt-3 flex items-center justify-between gap-2 text-2xs text-[--text-tertiary]"><span>{selected === index ? "Selected source" : `Source ${index + 1}`}</span><span>Score <span className="font-mono text-xs text-[--text-secondary]">{source.score.toFixed(3)}</span></span></span>
            </button>;
          })}
        </div>
        <div className="mt-6 border-t border-[--border-subtle] pt-5">
          <p className="break-words text-body font-medium text-[--text-primary]">{documentName ?? "Retrieved context"}</p>
          <p className="mt-2 text-xs text-[--text-tertiary]">{CATEGORY_LABELS[current.category as keyof typeof CATEGORY_LABELS] ?? current.category} · Score <span className="font-mono">{current.score.toFixed(3)}</span></p>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-[1.75] text-[--text-secondary]">{current.snippet}</p>
          <div className="mt-5 border-t border-[--border-subtle] pt-3 font-mono text-2xs text-[--text-tertiary] break-all">Vector {current.vectorId}{current.documentId != null ? ` · Document ${current.documentId}` : ""}</div>
          <Button type="button" variant="outline" onClick={() => { setHighlighted([current.vectorId], { [current.vectorId]: current.score }); openVectorLab("space"); onClose(false); requestAnimationFrame(() => document.getElementById("workspace")?.focus()); }} className="mt-5">View in Vector Lab <ArrowUpRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </aside>
  );
}
