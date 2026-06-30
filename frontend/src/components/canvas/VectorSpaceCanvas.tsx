import { useState, useCallback } from "react";
import type { Category } from "../../types";
import { useVectorCanvas } from "../../hooks/useVectorCanvas";
import { useCanvasStore } from "../../store/canvasStore";
import { CanvasLegend } from "./CanvasLegend";
import { CanvasOverlay } from "./CanvasOverlay";
import { VectorTooltip } from "./VectorTooltip";

export function VectorSpaceCanvas() {
  const vectors = useCanvasStore((s) => s.vectors);
  const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());

  const { svgRef, containerRef, tooltip, zoomLevel, resetZoom } = useVectorCanvas(vectors, hiddenCategories);

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

  const visibleCount = vectors.filter((v) => !hiddenCategories.has(v.category)).length;

  return (
    <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0a0a0a]">
      {/* 3D Depth Grid Background */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          backgroundPosition: 'center center'
        }}
      />

      {/* Radial Gradient Overlay for focal depth */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(10,10,10,0.85) 100%)'
        }}
      />

      <CanvasLegend
        hiddenCategories={hiddenCategories}
        onToggle={handleToggleCategory}
      />

      {/* The D3 SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full relative z-10"
        style={{ cursor: "grab" }}
        onDoubleClick={resetZoom}
      />

      <CanvasOverlay vectorCount={visibleCount} zoomLevel={zoomLevel} />

      {/* Tooltip needs relative z-index to overlay correctly */}
      {tooltip && (
        <div className="relative z-20">
          <VectorTooltip
            id={tooltip.id}
            category={tooltip.category}
            x={tooltip.x}
            y={tooltip.y}
            payload={tooltip.payload}
          />
        </div>
      )}
    </div>
  );
}
