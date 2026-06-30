import type { Algorithm, Category, DistanceMetric } from './vector';

export interface SearchResult {
  id: string;
  score: number;
  category: Category;
  snippet: string;
  x: number;
  y: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  latencyMs: number;
  algorithm: Algorithm;
  count: number;
}

export interface SearchParams {
  q: string;
  k?: number;
  algorithm?: Algorithm;
  metric?: DistanceMetric;
  category?: Category;
}
