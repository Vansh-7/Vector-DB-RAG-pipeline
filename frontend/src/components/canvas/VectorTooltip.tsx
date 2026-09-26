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
  const categoryColor = CATEGORY_COLORS[category] || '#888';

  return (
    <div
      className="absolute pointer-events-none transition-all duration-75 ease-out z-50"
      style={{
        left: Math.max(12, Math.min(x + 20, containerWidth - 296)),
        top: Math.max(12, Math.min(y - 20, containerHeight - 150)),
      }}
    >
      <div className="bg-[#0f0f0f] border border-[rgba(255,255,255,0.08)] rounded-md p-3 text-sm flex flex-col gap-1.5 min-w-[220px] max-w-[280px] shadow-2xl">
        <span className="font-mono text-[11px]" style={{ color: categoryColor }}>
          [{categoryLabel}]
        </span>
        <span className="font-mono text-[10px] text-[#888] break-all">{id}</span>
        
        <p className="text-[#f4f4f4] font-mono text-xs leading-relaxed">
          {payload || "No text payload available for this vector."}
        </p>
        {distance !== undefined && <span className="border-t border-[--border-subtle] pt-1 font-mono text-[10px] text-[#888]">DISTANCE {distance.toFixed(5)}</span>}
      </div>
    </div>
  );
}
