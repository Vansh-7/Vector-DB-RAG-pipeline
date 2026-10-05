import { CATEGORY_COLORS, CATEGORY_ORDER, CATEGORY_LABELS, type Category } from "../../types/vector";

interface CanvasLegendProps {
  hiddenCategories: Set<Category>;
  onToggle: (category: Category) => void;
}

export function CanvasLegend({ hiddenCategories, onToggle }: CanvasLegendProps) {
  return (
    <div className="absolute top-16 left-4 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-x-3 gap-y-2 z-10 pointer-events-auto rounded-md bg-panel/95 py-2 px-2.5">
      {CATEGORY_ORDER.map((category) => {
        const isHidden = hiddenCategories.has(category);
        return (
          <button
            key={category}
            type="button"
            onClick={() => onToggle(category)}
            aria-label={`${isHidden ? "Show" : "Hide"} ${CATEGORY_LABELS[category]} vectors`}
            aria-pressed={!isHidden}
            className="flex items-center gap-1.5 text-xs cursor-pointer transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] rounded-sm"
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
            <span className="text-[--text-secondary]">{CATEGORY_LABELS[category]}</span>
          </button>
        );
      })}
    </div>
  );
}
