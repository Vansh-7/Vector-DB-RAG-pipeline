import { CATEGORY_COLORS, CATEGORY_LABELS } from "../../types/vector";

interface VectorTooltipProps {
  id: string;
  category: any;
  x: number;
  y: number;
  payload?: string;
  distance?: number;
}

export function VectorTooltip({ category, x, y, payload }: VectorTooltipProps) {
  const categoryLabel = CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]?.toLowerCase() || 'unknown';
  const categoryColor = CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] || '#888';

  return (
    <div
      className="absolute pointer-events-none transition-all duration-75 ease-out z-50"
      style={{
        left: x + 20,
        top: y - 20,
      }}
    >
      <div className="bg-[#0f0f0f] border border-[rgba(255,255,255,0.08)] rounded-md p-3 text-sm flex flex-col gap-1.5 min-w-[220px] max-w-[280px] shadow-2xl">
        <span className="font-mono text-[11px]" style={{ color: categoryColor }}>
          [{categoryLabel}]
        </span>
        
        <p className="text-[#f4f4f4] font-mono text-xs leading-relaxed">
          {payload || "No text payload available for this vector."}
        </p>
      </div>
    </div>
  );
}
