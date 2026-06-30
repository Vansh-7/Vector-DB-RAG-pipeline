import type { Category } from '../../types';
import { CATEGORY_COLORS } from '../../types/vector';

const LEGEND_ITEMS: { category: Category; label: string }[] = [
  { category: 'TECH', label: 'TECH' },
  { category: 'FINANCE', label: 'FINANCE' },
  { category: 'FOOD', label: 'FOOD' },
  { category: 'SPORTS & GAMES', label: 'SPORTS & GAMES' },
  { category: 'DOCUMENTS', label: 'DOCUMENTS' },
  { category: 'MATHEMATICS', label: 'MATHEMATICS' },
];

interface CanvasLegendProps {
  hiddenCategories: Set<Category>;
  onToggle: (category: Category) => void;
}

export function CanvasLegend({ hiddenCategories, onToggle }: CanvasLegendProps) {
  return (
    <div className="absolute top-3 left-3 flex items-center gap-3 z-10">
      {LEGEND_ITEMS.map(({ category, label }) => {
        const isHidden = hiddenCategories.has(category);
        return (
          <button
            key={category}
            onClick={() => onToggle(category)}
            className="flex items-center gap-1.5 text-xs font-mono cursor-pointer transition-opacity"
            style={{ opacity: isHidden ? 0.3 : 0.8 }}
          >
            <div
              className="w-2.5 h-2.5 rounded-[2px] transition-opacity"
              style={{
                backgroundColor: CATEGORY_COLORS[category],
                opacity: isHidden ? 0.3 : 1,
              }}
            />
            <span className="text-[#888]">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
