import { useRef, useState } from "react";
import { ArrowRight, FilePlus2, FolderOpen, Plus, RefreshCw, Upload } from "lucide-react";
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
import { AddDocumentDrawer } from "./AddDocumentDrawer";
import { DocumentList } from "./DocumentList";

export function DocumentsView() {
  const userId = useAuthStore((s) => s.user?.id);
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const setIngestMode = useSessionStore((s) => s.setIngestMode);
  const { data: documents = [], isPending, isError, refetch } = useDocuments(true);
  const queryClient = useQueryClient();
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<DocumentRecord | null>(null);
  const [added, setAdded] = useState<IngestResponse | null>(null);
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
      setAdded(null);
      setDeletedName(documents.find((document) => document.id === id)?.name ?? "Document");
      setSelectedForDelete(null);
    },
  });

  const openDrawer = (mode?: "file" | "manual") => {
    if (mode) setIngestMode(mode);
    setAdded(null);
    setDrawerOpen(true);
  };

  const handleAdded = (result: IngestResponse) => {
    setProcessing(false);
    setDrawerOpen(false);
    setDeletedName(null);
    setAdded(result);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Knowledge</h2>
            {!isPending && !isError && <span className="font-mono text-2xs text-[--text-secondary] border border-[--border-subtle] rounded px-1.5 py-0.5">{documents.length}</span>}
          </div>
          <p className="mt-1 text-xs text-[--text-secondary]">The documents Kernspace uses to answer and search.</p>
        </div>
        <Button ref={addButtonRef} type="button" onClick={() => openDrawer()} className="h-9 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">
          <Plus className="w-4 h-4" aria-hidden="true" /> Add document
        </Button>
      </div>

      {added && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-success/20 bg-success/5 px-4 py-3">
          <p className="text-xs text-[--text-primary]">{added.status === "ready" ? `Document ready · ${added.chunk_count} ${added.chunk_count === 1 ? "chunk" : "chunks"} indexed.` : "Document added. Processing is in progress."}</p>
          {added.status === "ready" && <button type="button" onClick={() => setActiveView("chat")} className="flex items-center gap-1 text-xs text-success hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success">
            Ask a question <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>}
        </div>
      )}
      {deletedName && <p role="status" className="text-xs text-success">{deletedName} was deleted.</p>}
      {deleteMutation.isError && <p role="alert" className="text-xs text-error">{deleteMutation.error instanceof Error ? deleteMutation.error.message : "Document could not be deleted."}</p>}

      {isPending ? (
        <div aria-label="Loading documents" className="space-y-3 animate-pulse">
          {[1, 2, 3].map((index) => <div key={index} className="h-20 rounded-md border border-[--border-subtle] bg-elevated" />)}
        </div>
      ) : isError ? (
        <div role="alert" className="rounded-md border border-error/20 bg-panel px-5 py-7">
          <p className="text-sm font-medium">Documents could not be loaded.</p>
          <p className="mt-1 text-xs text-[--text-secondary]">Check the connection and try again.</p>
          <Button type="button" variant="outline" onClick={() => void refetch()} className="mt-4"><RefreshCw className="w-3.5 h-3.5" /> Retry</Button>
        </div>
      ) : documents.length === 0 ? (
        <div className="min-h-[340px] rounded-md border border-dashed border-[--border-default] bg-panel/50 flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-md border border-[--border-default] bg-elevated flex items-center justify-center text-[--color-info] mb-5">
            <FolderOpen className="w-5 h-5" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold">No knowledge indexed yet.</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[--text-secondary]">Upload a PDF, text file, or Markdown document, or paste text to start building your vector space.</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" onClick={() => openDrawer("file")}><Upload className="w-3.5 h-3.5" /> Upload file</Button>
            <Button type="button" variant="outline" onClick={() => openDrawer("manual")}><FilePlus2 className="w-3.5 h-3.5" /> Paste text</Button>
          </div>
        </div>
      ) : (
        <div>
          <p className="font-mono text-2xs tracking-widest text-[--text-tertiary] uppercase mb-3">Your documents</p>
          <DocumentList documents={documents} deletingId={deleteMutation.isPending ? deleteMutation.variables : null}
            onDelete={(document) => { deleteMutation.reset(); setDeletedName(null); setSelectedForDelete(document); }} />
        </div>
      )}

      <AddDocumentDrawer open={drawerOpen} onOpenChange={setDrawerOpen} onSuccess={handleAdded}
        processing={processing} onProcessingChange={setProcessing} returnFocusRef={addButtonRef} />
      <ConfirmDialog open={selectedForDelete !== null} onOpenChange={(open) => { if (!open) setSelectedForDelete(null); }}
        title="Delete document?" description={`Delete “${selectedForDelete?.name ?? "this document"}” and all of its indexed chunks? This cannot be undone.`}
        confirmLabel="Delete document" onConfirm={() => { if (selectedForDelete && !deleteMutation.isPending) deleteMutation.mutate(selectedForDelete.id); }} destructive />
    </div>
  );
}
