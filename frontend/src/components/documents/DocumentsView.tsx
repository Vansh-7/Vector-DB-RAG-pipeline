import { useState } from "react";
import { FilePlus2, FolderOpen, Plus, RefreshCw, Upload } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument } from "../../api/documents";
import { useDocuments } from "../../hooks/useDocuments";
import { useCanvasStore } from "../../store/canvasStore";
import { useAuthStore } from "../../store/authStore";
import { useSessionStore } from "../../store/sessionStore";
import type { DocumentRecord } from "../../types/document";
import type { IngestResponse } from "../../types/ingest";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { DocumentList } from "./DocumentList";
import { WorkspaceHeader } from "../layout/WorkspaceHeader";

export function DocumentsView({ onAddDocument, added, onClearAdded }: {
  onAddDocument: (mode?: "file" | "manual") => void;
  added: IngestResponse | null;
  onClearAdded: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const { data: documents = [], isPending, isError, error, refetch } = useDocuments(true);
  const queryClient = useQueryClient();
  const [selectedForDelete, setSelectedForDelete] = useState<DocumentRecord | null>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteDocument,
    onSuccess: (_result, id) => {
      queryClient.setQueryData<DocumentRecord[]>(["documents", userId], (current) => current?.filter((document) => document.id !== id));
      for (const key of ["documents", "dbStatus", "vectorSample", "vectorMeta", "search", "benchmarks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      useCanvasStore.getState().setHighlighted([]);
      useCanvasStore.getState().setQueryPoint(null);
      onClearAdded();
      setDeletedName(documents.find((document) => document.id === id)?.name ?? "Document");
      setSelectedForDelete(null);
    },
  });

  const openDrawer = (mode?: "file" | "manual") => {
    setDeletedName(null);
    onAddDocument(mode);
  };

  return (
    <div className="w-full">
      <WorkspaceHeader view="documents">
        <Button type="button" onClick={() => openDrawer()} className="h-9 shrink-0">
          <Plus className="w-4 h-4" aria-hidden="true" /> Add document
        </Button>
      </WorkspaceHeader>
      <div className="w-full max-w-6xl mx-auto px-5 sm:px-7 pb-8 pt-5 space-y-5">

      {added && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/20 bg-success/5 px-4 py-3">
          <p className="text-xs text-[--text-primary]">{added.status === "ready" ? `Document ready · ${added.chunk_count} ${added.chunk_count === 1 ? "chunk" : "chunks"} indexed.` : "Document added. Processing is in progress."}</p>
          {added.status === "ready" && <button type="button" onClick={() => setActiveView("chat")} className="flex items-center gap-1 text-xs text-success hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success">
            Ask a question
          </button>}
        </div>
      )}
      {deletedName && <p role="status" className="text-xs text-success">{deletedName} was deleted.</p>}
      {deleteMutation.isError && <p role="alert" className="text-xs text-error">{deleteMutation.error instanceof Error ? deleteMutation.error.message : "Document could not be deleted."}</p>}

      {isPending ? (
        <div role="status" aria-label="Loading documents" className="space-y-3 animate-pulse">
          {[1, 2, 3].map((index) => <div key={index} className="h-20 rounded-md border border-[--border-subtle] bg-elevated" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-md border border-error/20 bg-panel px-5 py-7">
          <p className="text-sm font-medium">Documents could not be loaded.</p>
          <p className="mt-1 text-xs text-[--text-secondary] break-words">{error instanceof Error ? error.message : "Check the connection and try again."}</p>
          <Button type="button" variant="outline" onClick={() => void refetch()} className="mt-4"><RefreshCw className="w-3.5 h-3.5" /> Retry</Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="min-h-[380px] flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-12 h-12 flex items-center justify-center text-[--text-secondary] mb-5">
            <FolderOpen className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold tracking-tight">Add your first document</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[--text-secondary]">Add a PDF, text file, or Markdown document. NeueBit uses it to answer questions and find related passages.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => openDrawer("file")}><Upload className="w-3.5 h-3.5" /> Upload file</Button>
            <Button type="button" variant="outline" onClick={() => openDrawer("manual")}><FilePlus2 className="w-3.5 h-3.5" /> Paste text</Button>
          </div>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-[--text-secondary]"><span className="font-mono text-xs">{documents.length}</span> {documents.length === 1 ? "document" : "documents"}</p>
            <p className="text-xs text-[--text-tertiary]">Upload PDF, TXT, or Markdown, or paste text.</p>
          </div>
          <DocumentList documents={documents} deletingId={deleteMutation.isPending ? deleteMutation.variables : null}
            onUploadAgain={() => openDrawer("file")}
            onDelete={(document) => { deleteMutation.reset(); setDeletedName(null); setSelectedForDelete(document); }} />
        </div>
      )}
      </div>

      <ConfirmDialog open={selectedForDelete !== null} onOpenChange={(open) => { if (!open) setSelectedForDelete(null); }}
        title="Delete document?" description={`Delete “${selectedForDelete?.name ?? "this document"}” and all of its indexed chunks? This cannot be undone.`}
        confirmLabel="Delete document" onConfirm={() => { if (selectedForDelete && !deleteMutation.isPending) deleteMutation.mutate(selectedForDelete.id); }}
        destructive busy={deleteMutation.isPending} error={deleteMutation.isError ? deleteMutation.error.message : null} closeOnConfirm={false} />
    </div>
  );
}
