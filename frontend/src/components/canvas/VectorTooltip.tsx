import type { Category } from '../../types';
import { CATEGORY_COLORS } from '../../types/vector';

interface VectorTooltipProps {
  id: string;
  category: Category;
  x: number;
  y: number;
  payload?: string;
}

export function VectorTooltip({ id, category, x, y, payload }: VectorTooltipProps) {
  return (
    <div
      className="absolute z-50 pointer-events-none"
      style={{
        left: x + 12,
        top: y - 8,
      }}
    >
      <div className="bg-[#1a1a1a] border border-[rgba(255,255,255,0.12)] rounded-[4px] px-2.5 py-1.5 shadow-lg">
        <div className="flex items-center gap-1.5 mb-0.5">
          <div
            className="w-2 h-2 rounded-[2px]"
            style={{ backgroundColor: CATEGORY_COLORS[category] }}
          />
          <span className="text-2xs font-mono text-[#aaa]">{id}</span>
        </div>
        <span
          className="text-2xs font-mono font-medium"
          style={{ color: CATEGORY_COLORS[category] }}
        >
          {category}
        </span>
        {payload && (
          <p className="text-2xs text-[#666] mt-0.5 max-w-[180px] truncate">
            {payload}
          </p>
        )}
      </div>
    </div>
  );
}
