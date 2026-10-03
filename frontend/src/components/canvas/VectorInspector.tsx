import { Crosshair, Layers3, X } from "lucide-react";
import { useCanvasStore } from "../../store/canvasStore";
import { ALGORITHM_DISPLAY, CATEGORY_COLORS, CATEGORY_LABELS, METRIC_DISPLAY } from "../../types/vector";
import type { DbStatusResponse } from "../../api/status";
import type { VectorPoint2D } from "../../types/vector";

export function VectorInspector({ status, vectors, count, onClose }: {
  status?: DbStatusResponse;
  vectors: VectorPoint2D[];
  count?: number;
  onClose: () => void;
}) {
  const highlightedIds = useCanvasStore((s) => s.highlightedIds);
  const highlightedScores = useCanvasStore((s) => s.highlightedScores);
  const queryPoint = useCanvasStore((s) => s.queryPoint);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);
  const selectedId = highlightedIds.length === 1 ? highlightedIds[0] : null;
  const selected = selectedId ? vectors.find((vector) => vector.id === selectedId) : null;
  const selectedDistance = selectedId ? highlightedScores[selectedId] : undefined;
  const selectedColor = selected ? CATEGORY_COLORS[selected.category] : undefined;

  return (
    <aside aria-label="Vector inspector" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }} className="flex h-full w-full min-h-0 min-w-0 flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-[--border-subtle] px-4 py-4">
        <h2 className="text-sm font-medium">Vector inspector</h2>
        <button type="button" onClick={onClose} aria-label="Close vector inspector" className="icon-button xl:hidden"><X className="h-4 w-4" /></button>
      </div>
      <div className="custom-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="pb-1"><p className="text-xs text-[--text-tertiary]">Your vectors</p><p className="mt-2 font-mono text-lg text-[--text-primary]">{count?.toLocaleString() ?? "—"}</p></div>
          <div className="pb-1"><p className="text-xs text-[--text-tertiary]">On canvas</p><p className="mt-2 font-mono text-lg text-[--text-primary]">{vectors.length.toLocaleString()}</p></div>
        </div>
        <p className="text-2xs leading-relaxed text-[--text-tertiary]">The canvas projects up to 2,000 of your searchable vectors into two dimensions.</p>

        <div className="border-t border-[--border-subtle] pt-5">
          <p className="flex items-center gap-2 text-2xs text-[--text-tertiary]"><Crosshair className="h-3 w-3" /> Selection</p>
          {selectedId ? <>
            <p className="mt-3 break-all font-mono text-xs text-[--text-primary]">{selectedId}</p>
            {selected ? <>
              <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: selectedColor }}><span className="h-2 w-2 rounded-sm" style={{ backgroundColor: selectedColor }} />{CATEGORY_LABELS[selected.category]}</div>
              {selected.payload && <p className="mt-3 break-words text-sm leading-relaxed text-[--text-primary]">{selected.payload}</p>}
            </> : <p className="mt-3 text-xs leading-relaxed text-[--text-secondary]">This vector is outside the current visualization sample.</p>}
            {selectedDistance !== undefined && <p className="mt-3 text-xs text-[--text-tertiary]">Distance <span className="font-mono text-[--text-secondary]">{selectedDistance.toFixed(5)}</span></p>}
            <button type="button" onClick={() => setHighlighted([])} className="mt-4 text-xs text-[--color-info] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Clear selection</button>
          </> : <p className="mt-3 text-xs leading-relaxed text-[--text-secondary]">{highlightedIds.length > 1 ? `${highlightedIds.length} vectors highlighted. Select one point to inspect it.` : "Select a point on the canvas or open a Search match here."}</p>}
        </div>

        <div className="border-t border-[--border-subtle] pt-5">
          <p className="flex items-center gap-2 text-2xs text-[--text-tertiary]"><Layers3 className="h-3 w-3" /> Query projection</p>
          {queryPoint ? <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-2xs">
            <div className="rounded-md bg-elevated p-2"><span className="text-[--text-tertiary]">PC1</span><p className="mt-1 text-[--color-warning]">{queryPoint.x.toFixed(3)}</p></div>
            <div className="rounded-md bg-elevated p-2"><span className="text-[--text-tertiary]">PC2</span><p className="mt-1 text-[--color-warning]">{queryPoint.y.toFixed(3)}</p></div>
          </div> : <p className="mt-3 text-xs leading-relaxed text-[--text-secondary]">Search or ask a question to project a query into vector space.</p>}
        </div>

        <div className="border-t border-[--border-subtle] pt-5">
          <p className="text-2xs text-[--text-tertiary]">Shared engine</p>
          <p className="mt-3 font-mono text-xs text-[--text-primary]">{status ? ALGORITHM_DISPLAY[status.engine] : "Status unavailable"}</p>
          <p className="mt-1 font-mono text-xs text-[--text-secondary]">{status ? METRIC_DISPLAY[status.metric] : "—"}</p>
        </div>
      </div>
    </aside>
  );
}
