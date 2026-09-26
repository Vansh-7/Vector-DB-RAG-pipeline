import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATEGORY_ORDER, type Algorithm, type Category, type DistanceMetric } from '../types/vector';

interface EngineState {
  algorithm: Algorithm;
  metric: DistanceMetric;
  topK: number;
  category: Category;
  modelName: string;
  setAlgorithm: (algorithm: Algorithm) => void;
  setMetric: (metric: DistanceMetric) => void;
  setTopK: (topK: number) => void;
  setCategory: (category: Category) => void;
  setModelName: (modelName: string) => void;
}

export const useEngineStore = create<EngineState>()(
  persist(
    (set) => ({
      algorithm: 'hnsw',
      metric: 'cosine',
      topK: 5,
      category: 'TECH',
      modelName: 'Ollama',
      setAlgorithm: (algorithm) => set({ algorithm }),
      setMetric: (metric) => set({ metric }),
      setTopK: (topK) => set({ topK }),
      setCategory: (category) => set({ category }),
      setModelName: (modelName) => set({ modelName }),
    }),
    {
      name: 'vectordb-engine-config',
      // The engine is shared server state; only local retrieval/injection preferences persist.
      partialize: (state) => ({
        topK: state.topK,
        category: state.category,
        modelName: state.modelName,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<EngineState> | null;
        return {
          ...current,
          topK: typeof saved?.topK === 'number' && Number.isFinite(saved.topK)
            ? Math.min(20, Math.max(1, Math.round(saved.topK))) : current.topK,
          category: saved?.category && saved.category !== 'DOCUMENTS' && CATEGORY_ORDER.includes(saved.category)
            ? saved.category : current.category,
          modelName: typeof saved?.modelName === 'string' ? saved.modelName : current.modelName,
        };
      },
    }
  )
);
