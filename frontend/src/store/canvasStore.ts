import { create } from 'zustand';
interface CanvasState {
  highlightedIds: string[];
  highlightedScores: Record<string, number>;
  queryPoint: { x: number; y: number } | null;
  setHighlighted: (ids: string[], scores?: Record<string, number>) => void;
  setQueryPoint: (point: { x: number; y: number } | null) => void;
  clearAll: () => void;
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  highlightedIds: [],
  highlightedScores: {},
  queryPoint: null,
  setHighlighted: (ids, scores = {}) => set({ highlightedIds: ids, highlightedScores: scores }),
  setQueryPoint: (point) => set({ queryPoint: point }),
  clearAll: () =>
    set({
      highlightedIds: [],
      highlightedScores: {},
      queryPoint: null,
    }),
}));
