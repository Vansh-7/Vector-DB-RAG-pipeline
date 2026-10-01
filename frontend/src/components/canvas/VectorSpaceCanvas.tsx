import { useState, useCallback } from "react";
// avoid-ai-design-ignore-file: CP3
// The arrows label the actual PCA axis directions; they are not action text.
import { Plus, Minus, Home } from "lucide-react";
import type { Category, VectorPoint2D } from "../../types";
import { useVectorCanvas } from "../../hooks/useVectorCanvas";
import { CanvasLegend } from "./CanvasLegend";
import { VectorTooltip } from "./VectorTooltip";
import { formatNumber } from "../../lib/utils";
import { Tooltip as UITooltip } from "../ui/Tooltip";
import { useSessionStore } from "../../store/sessionStore";

export function VectorSpaceCanvas({ vectors, count }: { vectors: VectorPoint2D[]; count?: number }) {
  const setActiveView = useSessionStore((s) => s.setActiveView);
  const openVectorLab = useSessionStore((s) => s.openVectorLab);
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());

  const { svgRef, containerRef, tooltip, zoomLevel, resetZoom, zoomIn, zoomOut } = useVectorCanvas(vectors, hiddenCategories);

  const handleToggleCategory = useCallback((category: Category) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-base flex flex-col">

      {/* Aesthetic Background with Depth */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.03)_0%,_transparent_100%)]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.28]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 100%)'
          }}
        />
      </div>

      {/* Top Gradient Fade to protect text readability */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-base via-base/80 to-transparent z-10 pointer-events-none" />

      {/* Header / Title */}
      <div className="absolute top-4 left-4 z-20 flex flex-col pointer-events-none">
        <h2 className="text-sm font-semibold text-[--text-primary]">Vector space</h2>
        <p className="text-2xs text-[--text-secondary] mt-0.5"><span className="font-mono">2D PCA</span> projection</p>
      </div>

      <CanvasLegend
        hiddenCategories={hiddenCategories}
        onToggle={handleToggleCategory}
      />

      {/* The D3 SVG Canvas */}
      <svg
        ref={svgRef}
        className="flex-1 w-full relative z-0"
        width="100%"
        height="100%"
        style={{ cursor: "grab" }}
        onDoubleClick={resetZoom}
      >
        <defs>
          <filter id="glow-bright" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
      </svg>

      {count === 0 && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
        <div className="pointer-events-auto max-w-sm p-6 text-center">
          <h3 className="text-lg font-semibold">Nothing to project yet.</h3>
          <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Add knowledge to build a searchable index, or inject a vector in Engine.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs">
            <button type="button" onClick={() => setActiveView("documents")} className="text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Add document</button>
            <button type="button" onClick={() => openVectorLab("engine")} className="text-[--text-secondary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Open Engine</button>
          </div>
        </div>
      </div>}

      {/* Quiet telemetry and a single control surface; PCA labels describe the fixed axes. */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end justify-between gap-3 z-20 pointer-events-none">
        <p className="pointer-events-auto rounded px-2 py-2 bg-base/80 text-xs text-[--text-tertiary]" title="Two-dimensional PCA projection of your searchable vectors">
          <span className="font-mono text-[--text-secondary]">2D</span> projection <span aria-hidden="true">·</span> <span className="font-mono text-[--text-secondary]">{count !== undefined ? formatNumber(count) : "—"}</span> vectors
        </p>
        <div role="group" aria-label="Canvas controls" className="flex items-center gap-0.5 pointer-events-auto rounded-md border border-[--border-subtle] bg-panel/95 p-0.5">
          <div className="hidden sm:flex h-8 items-center gap-2 px-2 font-mono text-2xs text-[--text-secondary]">
            <span title="Principal Component 2 (Y-Axis)">PC2 ↑</span>
            <span title="Principal Component 1 (X-Axis)">PC1 →</span>
          </div>
          <div aria-hidden="true" className="hidden sm:block w-px h-4 bg-[--border-default] mx-1" />
            <UITooltip content="Zoom In" side="top" sideOffset={8}>
              <button
                type="button"
                title="Zoom In"
                aria-label="Zoom in"
                onClick={zoomIn}
                className="icon-button"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </UITooltip>

            <div aria-label="Zoom level" className="flex h-8 items-center justify-center px-2 font-mono text-xs text-[--text-secondary] select-none min-w-[48px]">
              {Math.round(zoomLevel * 100)}%
            </div>
            <UITooltip content="Zoom Out" side="top" sideOffset={8}>
              <button
                type="button"
                title="Zoom Out"
                aria-label="Zoom out"
                onClick={zoomOut}
                className="icon-button"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </UITooltip>

            <div aria-hidden="true" className="w-px h-4 bg-[--border-default] mx-1" />

            <UITooltip content="Reset View" side="top" sideOffset={8}>
              <button
                type="button"
                title="Reset View"
                aria-label="Reset view"
                onClick={resetZoom}
                className="icon-button"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
            </UITooltip>
        </div>
      </div>

      {/* Tooltip needs relative z-index to overlay correctly */}
      {tooltip && (
        <div className="absolute inset-0 pointer-events-none z-30">
          <VectorTooltip
            id={tooltip.id}
            category={tooltip.category}
            x={tooltip.x}
            y={tooltip.y}
            payload={tooltip.payload}
            distance={tooltip.distance}
            containerWidth={containerRef.current?.clientWidth}
            containerHeight={containerRef.current?.clientHeight}
          />
        </div>
      )}
    </div>
  );
}
