import { create } from 'zustand';
import type { VectorMeta, VectorPoint2D } from '../types';

interface CanvasState {
  vectors: VectorPoint2D[];
  highlightedIds: string[];
  highlightedScores: Record<string, number>;
  queryPoint: { x: number; y: number } | null;
  meta: VectorMeta | null;
  pendingInserts: VectorPoint2D[];
  setVectors: (vectors: VectorPoint2D[]) => void;
  setHighlighted: (ids: string[], scores?: Record<string, number>) => void;
  setQueryPoint: (point: { x: number; y: number } | null) => void;
  setMeta: (meta: VectorMeta) => void;
  addPendingInsert: (vector: VectorPoint2D) => void;
  clearPendingInserts: () => void;
  clearAll: () => void;
}

export const useCanvasStore = create<CanvasState>()((set) => ({
  vectors: [],
  highlightedIds: [],
  highlightedScores: {},
  queryPoint: null,
  meta: null,
  pendingInserts: [],
  setVectors: (vectors) => set({ vectors }),
  setHighlighted: (ids, scores = {}) => set({ highlightedIds: ids, highlightedScores: scores }),
  setQueryPoint: (point) => set({ queryPoint: point }),
  setMeta: (meta) => set({ meta }),
  addPendingInsert: (vector) =>
    set((state) => ({
      pendingInserts: [...state.pendingInserts, vector],
      vectors: [...state.vectors, vector],
    })),
  clearPendingInserts: () => set({ pendingInserts: [] }),
  clearAll: () =>
    set({
      vectors: [],
      highlightedIds: [],
      queryPoint: null,
      pendingInserts: [],
      meta: null,
    }),
}));
