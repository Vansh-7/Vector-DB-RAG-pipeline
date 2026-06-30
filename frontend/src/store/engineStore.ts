import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Algorithm, Category, DistanceMetric } from '../types';

interface EngineState {
  algorithm: Algorithm;
  metric: DistanceMetric;
  topK: number;
  category: Category;
  setAlgorithm: (algorithm: Algorithm) => void;
  setMetric: (metric: DistanceMetric) => void;
  setTopK: (topK: number) => void;
  setCategory: (category: Category) => void;
}

export const useEngineStore = create<EngineState>()(
  persist(
    (set) => ({
      algorithm: 'hnsw',
      metric: 'cosine',
      topK: 5,
      category: 'TECH',
      setAlgorithm: (algorithm) => set({ algorithm }),
      setMetric: (metric) => set({ metric }),
      setTopK: (topK) => set({ topK }),
      setCategory: (category) => set({ category }),
    }),
    {
      name: 'vectordb-engine-config',
    }
  )
);
