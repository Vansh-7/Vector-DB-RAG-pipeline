import { FileText, Trash2, Type, Upload } from "lucide-react";
import type { DocumentRecord } from "../../types/document";

const STATUS_STYLES: Record<string, string> = {
  ready: "text-success bg-success/5 border-success/15",
  processing: "text-warning bg-warning/5 border-warning/15",
  failed: "text-error bg-error/5 border-error/15",
  deleting: "text-warning bg-warning/5 border-warning/15",
};

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function DocumentList({ documents, deletingId, onDelete, onUploadAgain }: {
  documents: DocumentRecord[];
  deletingId: number | null;
  onDelete: (document: DocumentRecord) => void;
  onUploadAgain: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[--border-subtle] bg-panel/60">
      <div aria-hidden="true" className="document-grid border-b border-[--border-subtle] bg-panel px-5 py-4 text-xs text-[--text-tertiary]">
        <span>Name</span><span>Status</span><span className="hidden md:block">Chunks</span><span className="hidden md:block">Added</span><span />
      </div>
      <ul className="divide-y divide-[--border-subtle]">
      {documents.map((document) => {
        const status = document.status.toLowerCase();
        const isDeleting = deletingId === document.id;
        return (
          <li key={document.id} className="document-grid group px-5 py-4 hover:bg-hover/30 transition-colors">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center text-[--text-secondary]">
              {document.source_type === "file" ? <FileText className="w-4 h-4" aria-hidden="true" /> : <Type className="w-4 h-4" aria-hidden="true" />}
              </div>
              <div className="min-w-0">
                <span className="block truncate text-body font-medium text-[--text-primary]" title={document.name}>{document.name}</span>
              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-2xs text-[--text-tertiary]">
                <span>{document.source_type === "file" ? "Uploaded file" : "Pasted text"}</span>
                <span className="md:hidden">· <span className="font-mono">{document.chunk_count.toLocaleString()}</span> chunks</span>
              </p>
              </div>
            </div>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[status] ?? "text-[--text-secondary] border-[--border-subtle]"}`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />{status}</span>
            <span className="hidden md:block font-mono text-xs text-[--text-secondary]" aria-label={`${document.chunk_count} chunks`}>{document.chunk_count.toLocaleString()}</span>
            <span className="hidden md:block font-mono text-2xs text-[--text-tertiary]">{formatDate(document.created_at)}</span>
            <button type="button" onClick={() => onDelete(document)} disabled={isDeleting || status === "deleting"}
              aria-label={`Delete ${document.name}`} title={`Delete ${document.name}`}
              className="icon-button text-[--text-tertiary] hover:bg-error/10 hover:text-error opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 focus-visible:opacity-100 disabled:opacity-40">
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </button>
            {status === "failed" && <details className="col-span-full ml-11 text-xs text-[--text-secondary]">
              <summary className="w-fit cursor-pointer rounded text-[--text-tertiary] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">Processing help</summary>
              <div className="mt-3 max-w-xl border-l border-[--border-default] pl-3">
                <p className="leading-relaxed">Document processing did not complete. Check that the file contains readable text, then upload it again. The previous attempt remains until you delete it.</p>
                <button type="button" onClick={onUploadAgain} className="mt-2 inline-flex min-h-8 items-center gap-1.5 rounded text-[--text-primary] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]"><Upload className="h-3.5 w-3.5" aria-hidden="true" /> Upload again</button>
              </div>
            </details>}
          </li>
        );
      })}
      </ul>
    </div>
  );
}
