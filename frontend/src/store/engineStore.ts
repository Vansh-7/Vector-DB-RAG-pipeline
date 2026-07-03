import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Algorithm, Category, DistanceMetric } from '../types';

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
    }
  )
);
