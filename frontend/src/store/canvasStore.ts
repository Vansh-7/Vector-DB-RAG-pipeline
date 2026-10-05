import { create } from 'zustand';
export interface SourceQueryHandoff {
  query: string;
  status: 'pending' | 'ready' | 'unavailable';
}
interface CanvasState {
  highlightedIds: string[];
  highlightedScores: Record<string, number>;
  queryPoint: { x: number; y: number } | null;
  sourceQueryHandoff: SourceQueryHandoff | null;
  setHighlighted: (ids: string[], scores?: Record<string, number>) => void;
  setQueryPoint: (point: { x: number; y: number } | null) => void;
  beginSourceHandoff: (id: string, score: number, query: string | null) => void;
  finishSourceHandoff: (handoff: SourceQueryHandoff, point: { x: number; y: number } | null) => void;
  clearAll: () => void;
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  highlightedIds: [],
  highlightedScores: {},
  queryPoint: null,
  sourceQueryHandoff: null,
  setHighlighted: (ids, scores = {}) => set({ highlightedIds: ids, highlightedScores: scores }),
  setQueryPoint: (point) => set({ queryPoint: point, sourceQueryHandoff: null }),
  beginSourceHandoff: (id, score, query) => set({
    highlightedIds: [id],
    highlightedScores: { [id]: score },
    queryPoint: null,
    sourceQueryHandoff: query?.trim() ? { query, status: 'pending' } : null,
  }),
  finishSourceHandoff: (handoff, point) => set((state) => {
    // A reset or newer inspection makes an earlier response irrelevant.
    if (state.sourceQueryHandoff !== handoff || handoff.status !== 'pending') return state;
    return { queryPoint: point, sourceQueryHandoff: { ...handoff, status: point ? 'ready' : 'unavailable' } };
  }),
  clearAll: () =>
    set({
      highlightedIds: [],
      highlightedScores: {},
      queryPoint: null,
      sourceQueryHandoff: null,
    }),
}));
