import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORY_ORDER, type Category } from '../types/vector';

interface EngineState {
  topK: number;
  category: Category;
  setTopK: (topK: number) => void;
  setCategory: (category: Category) => void;
}

export const useEngineStore = create<EngineState>()(
  persist(
    (set) => ({
      topK: 5,
      category: 'TECH',
      setTopK: (topK) => set({ topK }),
      setCategory: (category) => set({ category }),
    }),
    {
      name: 'vectordb-engine-config',
      // The engine is shared server state; only local retrieval/injection preferences persist.
      partialize: (state) => ({
        topK: state.topK,
        category: state.category,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<EngineState> | null;
        return {
          ...current,
          topK: typeof saved?.topK === 'number' && Number.isFinite(saved.topK)
            ? Math.min(20, Math.max(1, Math.round(saved.topK))) : current.topK,
          category: saved?.category && saved.category !== 'DOCUMENTS' && CATEGORY_ORDER.includes(saved.category)
            ? saved.category : current.category,
        };
      },
    }
  )
);
