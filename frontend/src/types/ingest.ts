import type { Category } from './vector';

export interface IngestRequest {
  text: string;
  category: Category;
  title?: string;
}

export interface IngestResponse {
  document_id: number;
  status: string;
  chunk_count: number;
  message: string;
}
