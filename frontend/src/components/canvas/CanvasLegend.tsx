import { CATEGORY_COLORS, CATEGORY_ORDER, CATEGORY_LABELS, type Category } from "../../types/vector";

interface CanvasLegendProps {
  hiddenCategories: Set<Category>;
  onToggle: (category: Category) => void;
}

export function CanvasLegend({ hiddenCategories, onToggle }: CanvasLegendProps) {
  return (
    <div className="absolute top-16 left-4 flex flex-wrap max-w-full items-center gap-3 z-10 pointer-events-auto bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-[6px] py-1.5 px-2 shadow-sm">
      {CATEGORY_ORDER.map((category) => {
        const isHidden = hiddenCategories.has(category);
        return (
          <button
            key={category}
            onClick={() => onToggle(category)}
            className="flex items-center gap-1.5 text-[11px] font-mono cursor-pointer transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#555] rounded-sm"
            style={{ opacity: isHidden ? 0.3 : 0.8 }}
            title={`Toggle ${CATEGORY_LABELS[category]}`}
          >
            <div
              className="w-2.5 h-2.5 rounded-[2px] transition-opacity"
              style={{
                backgroundColor: CATEGORY_COLORS[category],
                opacity: isHidden ? 0.3 : 1,
              }}
            />
            <span className="text-[#888] tracking-widest uppercase">{CATEGORY_LABELS[category]}</span>
          </button>
        );
      })}
    </div>
  );
}
