import { CATEGORY_COLORS, CATEGORY_LABELS, type Category } from "../../types/vector";

interface VectorTooltipProps {
  id: string;
  category: Category;
  x: number;
  y: number;
  payload?: string;
  distance?: number;
  containerWidth?: number;
  containerHeight?: number;
}

export function VectorTooltip({ id, category, x, y, payload, distance, containerWidth = 320, containerHeight = 200 }: VectorTooltipProps) {
  const categoryLabel = CATEGORY_LABELS[category]?.toLowerCase() || 'unknown';
  const categoryColor = CATEGORY_COLORS[category] || 'var(--text-secondary)';

  return (
    <div
      className="absolute pointer-events-none transition-all duration-75 ease-out z-50"
      style={{
        left: Math.max(12, Math.min(x + 20, containerWidth - 296)),
        top: Math.max(12, Math.min(y - 20, containerHeight - 150)),
      }}
    >
      <div className="bg-elevated border border-[--border-strong] rounded-md p-3 text-sm flex flex-col gap-1.5 min-w-[220px] max-w-[280px] shadow-2xl">
        <span className="text-xs" style={{ color: categoryColor }}>
          {categoryLabel}
        </span>
        <span className="font-mono text-[10px] text-[--text-secondary] break-all">{id}</span>
        
        <p className="text-[--text-primary] text-sm leading-relaxed">
          {payload || "No text payload available for this vector."}
        </p>
        {distance !== undefined && <span className="border-t border-[--border-subtle] pt-1 font-mono text-[10px] text-[--text-secondary]">DISTANCE {distance.toFixed(5)}</span>}
      </div>
    </div>
  );
}
