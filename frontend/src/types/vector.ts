// avoid-ai-design-ignore-file: SD8
// Category colors are part of the existing vector visualization contract.
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
  TECH: 'var(--color-tech)',
  FINANCE: 'var(--color-finance)',
  FOOD: 'var(--color-food)',
  'SPORTS & GAMES': 'var(--color-sports)',
  DOCUMENTS: 'var(--color-documents)',
  MATHEMATICS: 'var(--color-mathematics)',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  TECH: 'Tech',
  MATHEMATICS: 'Maths',
  FINANCE: 'Finance',
  FOOD: 'Food',
  'SPORTS & GAMES': 'Sports & Games',
  DOCUMENTS: 'Document',
};

export const CATEGORY_ORDER: Category[] = [
  'TECH',
  'MATHEMATICS',
  'FINANCE',
  'FOOD',
  'SPORTS & GAMES',
  'DOCUMENTS',
];


export const ALGORITHM_DISPLAY: Record<Algorithm, string> = {
  hnsw: 'HNSW Graph',
  kdtree: 'KD-tree',
  exact: 'Brute Force (Exact Match)',
};

export const METRIC_DISPLAY: Record<DistanceMetric, string> = {
  cosine: 'Cosine Similarity',
  euclidean: 'Euclidean',
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

export interface InsertVectorRequest {
  category: Category;
  payload: string;
  embedding?: number[];
}

export interface InsertVectorResponse {
  status: string;
  message: string;
}

export interface DeleteVectorsResponse {
  deleted: number;
  message: string;
}
