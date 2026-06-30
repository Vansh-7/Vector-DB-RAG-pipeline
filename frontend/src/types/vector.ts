export type Algorithm = 'hnsw' | 'kdtree' | 'exact';

export type DistanceMetric = 'cosine' | 'euclidean' | 'manhattan';

export type Category =
  | 'TECH'
  | 'FINANCE'
  | 'FOOD'
  | 'SPORTS & GAMES'
  | 'DOCUMENTS'
  | 'MATHEMATICS';

export const CATEGORY_COLORS: Record<Category, string> = {
  TECH: '#a78bfa',
  FINANCE: '#34d399',
  FOOD: '#f97316',
  'SPORTS & GAMES': '#38bdf8',
  DOCUMENTS: '#e879f9',
  MATHEMATICS: '#facc15',
};

export const ALGORITHM_DISPLAY: Record<Algorithm, string> = {
  hnsw: 'HNSW Graph',
  kdtree: 'KD-Tree',
  exact: 'Brute Force (Exact Match)',
};

export const METRIC_DISPLAY: Record<DistanceMetric, string> = {
  cosine: 'Cosine Similarity',
  euclidean: 'Euclidean Distance',
  manhattan: 'Manhattan Distance',
};

export interface VectorPoint2D {
  id: string;
  x: number;
  y: number;
  category: Category;
  payload?: string;
}

export interface VectorSampleResponse {
  vectors: VectorPoint2D[];
  count: number;
}

export interface VectorMeta {
  dimensions: number;
  totalVectors: number;
  indexAlgorithm: Algorithm;
  lastUpdated: string;
}

export interface InsertVectorRequest {
  category: Category;
  payload: string;
  embedding?: number[];
}

export interface InsertVectorResponse {
  id: string;
  x: number;
  y: number;
  category: Category;
  message: string;
}

export interface DeleteVectorsResponse {
  deleted: number;
  message: string;
}
