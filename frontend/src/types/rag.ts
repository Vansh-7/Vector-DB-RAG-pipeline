import type { Algorithm, Category, DistanceMetric } from './vector';

export interface RAGQueryRequest {
  query: string;
  algorithm: Algorithm;
  metric: DistanceMetric;
  topK: number;
  stream?: boolean;
}

export interface RAGSource {
  vectorId: string;
  score: number;
  snippet: string;
  category: Category;
}

export interface RAGResponse {
  response: string;
  sources: RAGSource[];
  tokensUsed: number;
  model: string;
  latencyMs: number;
}

export type SSEEvent =
  | { type: 'token'; content: string }
  | { type: 'done'; sources: RAGSource[]; tokensUsed: number; latencyMs: number }
  | { type: 'error'; detail: string };

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: RAGSource[];
  tokensUsed?: number;
  timestamp: string;
}
