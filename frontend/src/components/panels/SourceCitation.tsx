import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { RAGSource } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types';
import { getScoreColor } from '../../lib/utils';
import { useCanvasStore } from '../../store/canvasStore';

interface SourceCitationProps {
  sources: RAGSource[];
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);

  // UX: Serial Position Effect — Order by relevance descending so best recall is first
  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => b.score - a.score);
  }, [sources]);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-3 bg-[#111111] rounded-[6px] border border-[rgba(255,255,255,0.06)] overflow-hidden">
      {/* UX: Fitts's Law — Full-width clickable row for the toggle target */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-[--text-secondary] hover:bg-[#161616] transition-colors outline-none focus-visible:bg-[#161616]"
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span className="font-sans">Sources Used ({sources.length})</span>
        </div>
      </button>

      {/* UX: Miller's Law — Collapsed by default, expanded reveals readable chunks, not raw JSON */}
      <div
        className={`transition-all duration-200 ease-out overflow-hidden ${
          expanded ? 'max-h-[800px] border-t border-[rgba(255,255,255,0.06)]' : 'max-h-0'
        }`}
      >
        <div className="flex flex-col">
          {sortedSources.map((src, i) => {
            const isTopSource = i === 0;
            const categoryColor = CATEGORY_COLORS[src.category as keyof typeof CATEGORY_COLORS] || '#888';
            const categoryLabel = CATEGORY_LABELS[src.category as keyof typeof CATEGORY_LABELS] || src.category;
            
            return (
              <div
                key={`${src.vectorId}-${i}`}
                onClick={() => setHighlighted([src.vectorId], { [src.vectorId]: src.score })}
                className={`group flex flex-col gap-2 p-3 border-b border-[rgba(255,255,255,0.04)] last:border-b-0 hover:bg-[#161616] cursor-pointer transition-colors ${
                  isTopSource ? 'bg-[#141414]' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span 
                      className="font-mono text-[11px] font-medium" 
                      style={{ color: categoryColor }}
                    >
                      {src.vectorId}
                    </span>
                    <span
                      className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-[1px] rounded-[2px]"
                      style={{ backgroundColor: `${categoryColor}15`, color: categoryColor }}
                    >
                      {categoryLabel}
                    </span>
                  </div>
                  <span 
                    className="font-mono text-[11px] font-semibold px-1.5 py-[1px] rounded-[2px]" 
                    style={{ 
                      color: getScoreColor(src.score),
                      backgroundColor: isTopSource ? `${getScoreColor(src.score)}15` : 'transparent'
                    }}
                  >
                    {src.score.toFixed(3)}
                  </span>
                </div>
                <p className="text-xs text-[--text-secondary] leading-relaxed line-clamp-2">
                  {src.snippet}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
