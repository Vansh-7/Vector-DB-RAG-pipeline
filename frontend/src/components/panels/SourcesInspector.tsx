import { useState } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import { useDocuments } from "../../hooks/useDocuments";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import type { RAGSource } from "../../types/rag";
import { CATEGORY_LABELS } from "../../types/vector";
import { Button } from "../ui/Button";
import { ContextPane } from "../layout/ContextPane";

export function SourcesInspector({ sources, originatingQuery, onClose, active }: {
  sources: RAGSource[];
  originatingQuery: string | null;
  onClose: (restoreFocus?: boolean) => void;
  active: boolean;
}) {
  const documents = useDocuments().data ?? [];
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const beginSourceHandoff = useCanvasStore((s) => s.beginSourceHandoff);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const [selected, setSelected] = useState(0);
  const current = sources[selected] ?? sources[0];
  const documentName = documents.find((document) => document.id === current?.documentId)?.name;
  if (!current) return null;

  return <ContextPane open={active} title="Answer sources" onClose={() => onClose()}
    description={<><span className="font-mono">{sources.length}</span> retrieved {sources.length === 1 ? "chunk" : "chunks"}</>}>
    <div className="space-y-6 p-5">
      {sources.length > 1 && <nav aria-label="Retrieved sources" className="space-y-1">
        {sources.map((source, index) => {
          const name = documents.find((document) => document.id === source.documentId)?.name;
          return <button key={source.vectorId + "-" + index} type="button"
            onClick={() => { setSelected(index); setHighlighted([source.vectorId], { [source.vectorId]: source.score }); }}
            aria-current={current === source ? "true" : undefined}
            className={"flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] " + (current === source ? "bg-elevated font-medium text-[--text-primary]" : "text-[--text-secondary] hover:bg-hover")}>
            <span className="font-mono text-[--text-tertiary]">{index + 1}</span><FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate" title={name ?? source.vectorId}>{name ?? "Source " + (index + 1)}</span>
          </button>;
        })}
      </nav>}
      <section aria-label="Retrieved passage">
        <h3 className="pane-section-label">Passage</h3>
        <div className="mt-3 space-y-3 break-words text-sm leading-[1.75] text-[--text-primary]">
          {/* Join extraction line wraps for reading; retain actual paragraph boundaries. */}
          {current.snippet.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph.replace(/\s*\n\s*/g, " ")}</p>)}
        </div>
      </section>
      <section className="border-t border-[--border-subtle] pt-5" aria-label="Source document">
        <h3 className="pane-section-label">Document</h3>
        <p className="mt-3 break-words text-sm font-medium">{documentName ?? "Retrieved context"}</p>
        <p className="mt-1.5 text-xs text-[--text-secondary]">{CATEGORY_LABELS[current.category as keyof typeof CATEGORY_LABELS] ?? current.category}</p>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex justify-between gap-4"><dt className="text-[--text-secondary]">Retrieval score</dt><dd className="font-mono">{current.score.toFixed(3)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="shrink-0 text-[--text-secondary]">Vector ID</dt><dd className="break-all text-right font-mono">{current.vectorId}</dd></div>
          {current.documentId != null && <div className="flex justify-between gap-4"><dt className="text-[--text-secondary]">Document ID</dt><dd className="font-mono">{current.documentId}</dd></div>}
        </dl>
        <Button type="button" variant="ghost" onClick={() => {
          beginSourceHandoff(current.vectorId, current.score, originatingQuery);
          openVectorLab("space"); onClose(false);
          requestAnimationFrame(() => document.getElementById("workspace")?.focus());
        }} className="mt-5 !px-0 text-[--color-info]">View in Vector Lab <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
      </section>
    </div>
  </ContextPane>;
}
