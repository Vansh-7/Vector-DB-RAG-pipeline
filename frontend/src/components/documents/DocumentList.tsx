import { FileText, Trash2, Type } from "lucide-react";
import type { DocumentRecord } from "../../types/document";

const STATUS_STYLES: Record<string, string> = {
  ready: "text-success border-success/20 bg-success/10",
  processing: "text-warning border-warning/20 bg-warning/10",
  failed: "text-error border-error/20 bg-error/10",
  deleting: "text-warning border-warning/20 bg-warning/10",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function DocumentList({ documents, deletingId, onDelete }: {
  documents: DocumentRecord[];
  deletingId: number | null;
  onDelete: (document: DocumentRecord) => void;
}) {
  return (
    <ul className="divide-y divide-[--border-subtle] border-y border-[--border-subtle]">
      {documents.map((document) => {
        const status = document.status.toLowerCase();
        const isDeleting = deletingId === document.id;
        return (
          <li key={document.id} className="group flex items-start gap-3 px-2 sm:px-3 py-4 hover:bg-hover/40 transition-colors min-w-0">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border border-[--border-subtle] bg-elevated text-[--text-secondary]">
              {document.source_type === "file" ? <FileText className="w-4 h-4" aria-hidden="true" /> : <Type className="w-4 h-4" aria-hidden="true" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm font-medium text-[--text-primary]" title={document.name}>{document.name}</span>
                <span className={`shrink-0 rounded-[3px] border px-1.5 py-0.5 font-mono text-[10px] capitalize ${STATUS_STYLES[status] ?? "text-[--text-secondary] border-[--border-default] bg-elevated"}`}>
                  {status}
                </span>
              </div>
              <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[--text-secondary]">
                <span>{document.source_type === "file" ? "Uploaded file" : "Pasted text"}</span>
                <span>{document.category}</span>
                <span>{document.chunk_count.toLocaleString()} {document.chunk_count === 1 ? "chunk" : "chunks"}</span>
                <span>{formatDate(document.created_at)}</span>
              </p>
            </div>
            <button type="button" onClick={() => onDelete(document)} disabled={isDeleting || status === "deleting"}
              aria-label={`Delete ${document.name}`} title={`Delete ${document.name}`}
              className="mt-0.5 shrink-0 rounded p-2 text-[--text-tertiary] hover:bg-error/10 hover:text-error opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error disabled:cursor-not-allowed disabled:opacity-40">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
