import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearDatabase, deleteVector, saveDatabase } from "../../api/vectors";
import { useCanvasStore } from "../../store/canvasStore";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function MaintenancePanel() {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [vectorId, setVectorId] = useState("");
  const clearAll = useCanvasStore((s) => s.clearAll);
  const highlightedIds = useCanvasStore((s) => s.highlightedIds);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const queryClient = useQueryClient();
  const clearMutation = useMutation({
    mutationFn: clearDatabase,
    onSuccess: () => {
      clearAll();
      for (const key of ["documents", "dbStatus", "vectorMeta", "vectorSample", "search", "benchmarks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setShowClearDialog(false);
    },
  });
  const saveMutation = useMutation({ mutationFn: saveDatabase });
  const deleteMutation = useMutation({
    mutationFn: deleteVector,
    onSuccess: (_response, id) => {
      if (highlightedIds.includes(id)) setHighlighted([]);
      for (const key of ["documents", "dbStatus", "vectorMeta", "vectorSample", "search", "benchmarks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setVectorId("");
      setShowDeleteDialog(false);
    },
  });
  const busy = clearMutation.isPending || saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <div>
        <p className="font-mono text-2xs uppercase tracking-[0.2em] text-[--color-info]">Operations / 04</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Maintenance</h2>
        <p className="mt-1 text-xs leading-relaxed text-[--text-secondary]">Save the shared index or manage the vectors and documents owned by your account.</p>
      </div>
      <div className="border border-[--border-subtle] rounded-md bg-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">Save to Disk</h3>
          <p className="text-xs text-[#888] mt-1">Create a snapshot of the shared vector index.</p>
        </div>
        <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={busy}>
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save to Disk
        </Button>
      </div>
      {saveMutation.isSuccess && <p role="status" className="text-xs text-success">Snapshot saved to disk.</p>}
      {saveMutation.isError && <p role="alert" className="text-xs text-error break-words">{saveMutation.error.message}</p>}
      <div className="border border-[--border-subtle] rounded-md bg-panel p-4">
        <div>
          <h3 className="text-sm font-semibold">Delete a vector</h3>
          <p className="text-xs text-[#888] mt-1 leading-relaxed">Remove one indexed vector by ID. Use Documents to delete an entire source.</p>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 text-xs text-[--text-secondary]">
            Vector ID
            <input value={vectorId} onChange={(event) => setVectorId(event.target.value)} placeholder="Enter vector ID"
              className="mt-1.5 h-9 w-full rounded-[4px] border border-[--border-default] bg-elevated px-3 font-mono text-xs text-[--text-primary] outline-none focus:border-[--color-info]" />
          </label>
          {highlightedIds.length === 1 && <Button type="button" variant="outline" onClick={() => setVectorId(highlightedIds[0])} disabled={busy}>Use selected</Button>}
          <Button type="button" variant="danger" onClick={() => { deleteMutation.reset(); setShowDeleteDialog(true); }} disabled={busy || !vectorId.trim()}>
            <Trash2 className="w-3.5 h-3.5" /> Delete vector
          </Button>
        </div>
        {deleteMutation.isSuccess && <p role="status" className="mt-3 text-xs text-success">Vector deleted.</p>}
      </div>
      <div className="border border-error/20 rounded-md bg-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-md">
          <h3 className="text-sm font-semibold">Clear vector data</h3>
          <p className="text-xs text-[#888] mt-1 leading-relaxed">Delete your indexed vectors and document metadata. Saved conversations are not deleted.</p>
        </div>
        <Button variant="danger" onClick={() => { clearMutation.reset(); setShowClearDialog(true); }} disabled={busy}>
          {clearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clear data
        </Button>
      </div>
      {clearMutation.isSuccess && <p role="status" className="text-xs text-success">Your vector data was cleared.</p>}
      {clearMutation.isError && <p role="alert" className="text-xs text-error break-words">{clearMutation.error.message}</p>}
      <ConfirmDialog open={showClearDialog} onOpenChange={setShowClearDialog} title="Clear your vector data?"
        description="This permanently deletes your vectors and document metadata. Your conversations and other users' knowledge are not deleted. This action cannot be undone."
        confirmLabel="Clear my data" onConfirm={() => { if (!busy) clearMutation.mutate(); }} destructive
        busy={clearMutation.isPending} error={clearMutation.isError ? clearMutation.error.message : null} closeOnConfirm={false} />
      <ConfirmDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} title="Delete this vector?"
        description={`Permanently delete vector ${vectorId.trim()}? The source document will remain, but this passage will no longer appear in search.`}
        confirmLabel="Delete vector" onConfirm={() => { if (!busy && vectorId.trim()) deleteMutation.mutate(vectorId.trim()); }}
        destructive busy={deleteMutation.isPending} error={deleteMutation.isError ? deleteMutation.error.message : null} closeOnConfirm={false} />
    </div>
  );
}
