import { useState } from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearDatabase, saveDatabase } from "../../api/vectors";
import { useCanvasStore } from "../../store/canvasStore";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function MaintenancePanel() {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const clearAll = useCanvasStore((s) => s.clearAll);
  const queryClient = useQueryClient();
  const clearMutation = useMutation({
    mutationFn: clearDatabase,
    onSuccess: () => {
      clearAll();
      for (const key of ["dbStatus", "vectorSample", "search", "benchmarks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setShowClearDialog(false);
    },
  });
  const saveMutation = useMutation({ mutationFn: saveDatabase });
  const busy = clearMutation.isPending || saveMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="border border-[--border-subtle] rounded-md bg-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Save to Disk</h2>
          <p className="text-xs text-[#888] mt-1">Create a snapshot of the shared vector index.</p>
        </div>
        <Button variant="outline" onClick={() => saveMutation.mutate()} disabled={busy}>
          {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save to Disk
        </Button>
      </div>
      {saveMutation.isSuccess && <p role="status" className="text-xs text-success">Snapshot saved to disk.</p>}
      {saveMutation.isError && <p role="alert" className="text-xs text-error break-words">{saveMutation.error.message}</p>}
      <div className="border border-error/20 rounded-md bg-panel p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="max-w-md">
          <h2 className="text-sm font-semibold">Clear vector data</h2>
          <p className="text-xs text-[#888] mt-1 leading-relaxed">Delete your indexed vectors and document metadata. Saved conversations are not deleted.</p>
        </div>
        <Button variant="danger" onClick={() => setShowClearDialog(true)} disabled={busy}>
          {clearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Clear data
        </Button>
      </div>
      {clearMutation.isSuccess && <p role="status" className="text-xs text-success">Your vector data was cleared.</p>}
      {clearMutation.isError && <p role="alert" className="text-xs text-error break-words">{clearMutation.error.message}</p>}
      <ConfirmDialog open={showClearDialog} onOpenChange={setShowClearDialog} title="Clear your vector data?"
        description="This permanently deletes your vectors and document metadata. Your conversations and other users' knowledge are not deleted. This action cannot be undone."
        confirmLabel="Clear my data" onConfirm={() => { if (!busy) clearMutation.mutate(); }} destructive />
    </div>
  );
}
