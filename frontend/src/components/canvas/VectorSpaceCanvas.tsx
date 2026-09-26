import { useState, useCallback } from "react";
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
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0a0a0a] flex flex-col">

      {/* Aesthetic Background with Depth */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Deep background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.03)_0%,_transparent_100%)]" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.12]"
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
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent z-10 pointer-events-none" />

      {/* Header / Title */}
      <div className="absolute top-4 left-4 z-20 flex flex-col pointer-events-none">
        <h2 className="text-sm font-semibold text-[#f4f4f4]">Vector Space Canvas</h2>
        <p className="text-[10px] text-[#888] mt-0.5">2D PCA Projection · Semantic Space</p>
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
        <div className="pointer-events-auto max-w-sm rounded-md border border-[--border-default] bg-panel/95 p-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
          <p className="font-mono text-2xs uppercase tracking-[0.18em] text-[--color-info]">Vector space / empty</p>
          <h3 className="mt-2 text-sm font-semibold">Nothing to project yet.</h3>
          <p className="mt-2 text-xs leading-relaxed text-[--text-secondary]">Add knowledge to build a searchable index, or inject a vector in Engine.</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-xs">
            <button type="button" onClick={() => setActiveView("documents")} className="text-[--color-info] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Add document</button>
            <button type="button" onClick={() => openVectorLab("engine")} className="text-[--text-secondary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">Open Engine</button>
          </div>
        </div>
      </div>}

      {/* Canvas bottom controls and footer overlay */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-20 pointer-events-none">

        {/* Left Side: Stats (Aligned with sidebar sync cluster area horizontally) */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <div className="border border-[rgba(255,255,255,0.06)] bg-[#111] rounded-[4px] px-3 py-1 flex flex-col justify-center min-w-[100px] shadow-sm">
            <span className="text-[10px] text-[#888]" title="The current API does not report embedding dimensionality">Projection dims</span>
            <span className="text-[13px] font-mono font-medium text-[#f4f4f4]">
              2D
            </span>
          </div>

          <div className="border border-[rgba(255,255,255,0.06)] bg-[#111] rounded-[4px] px-3 py-1 flex flex-col justify-center min-w-[120px] shadow-sm">
            <span className="text-[10px] text-[#888]">Your vectors</span>
            <span className="text-[13px] font-mono font-medium text-[#f4f4f4]">
              {count !== undefined ? formatNumber(count) : "—"}
            </span>
          </div>
        </div>

        {/* Right Side: PC Labels & Zoom Controls */}
        <div className="flex items-center gap-4 pointer-events-auto">
          {/* Axis Labels */}
          <div className="flex items-center gap-2 font-mono text-[10px] font-medium text-[#555] bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-[4px] px-2 py-1 shadow-sm">
            <span title="Principal Component 2 (Y-Axis)">PC2 ↑</span>
            <div className="w-px h-3 bg-[rgba(255,255,255,0.1)]" />
            <span title="Principal Component 1 (X-Axis)">PC1 →</span>
          </div>

          {/* Zoom & Reset Controls */}
          <div className="flex items-center bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-[4px] shadow-sm p-0.5">
            <UITooltip content="Zoom In" side="top" sideOffset={8}>
              <button
                type="button"
                title="Zoom In"
                onClick={zoomIn}
                className="p-1.5 text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] rounded-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#555]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </UITooltip>

            <div className="w-px h-3 bg-[rgba(255,255,255,0.1)] mx-0.5" />
            <div className="px-2 font-mono text-[10px] text-[#888] select-none min-w-[44px] text-center">
              {Math.round(zoomLevel * 100)}%
            </div>
            <div className="w-px h-3 bg-[rgba(255,255,255,0.1)] mx-0.5" />

            <UITooltip content="Zoom Out" side="top" sideOffset={8}>
              <button
                type="button"
                title="Zoom Out"
                onClick={zoomOut}
                className="p-1.5 text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] rounded-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#555]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
            </UITooltip>

            <div className="w-px h-3 bg-[rgba(255,255,255,0.1)] mx-0.5" />

            <UITooltip content="Reset View" side="top" sideOffset={8}>
              <button
                type="button"
                title="Reset View"
                onClick={resetZoom}
                className="p-1.5 text-[#888] hover:text-[#f4f4f4] hover:bg-[#1a1a1a] rounded-[2px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#555]"
              >
                <Home className="w-3.5 h-3.5" />
              </button>
            </UITooltip>
          </div>
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
