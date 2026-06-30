import type { Category } from './vector';

export interface IngestRequest {
  title: string;
  content: string;
  category: Category;
}

export interface IngestResponse {
  chunksAdded: number;
  vectorIds: string[];
  embeddingModel: string;
  message: string;
}
