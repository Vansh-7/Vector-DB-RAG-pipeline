import type { Category } from './vector';

export interface IngestRequest {
  text: string;
  category: Category;
}

export interface IngestResponse {
  message: string;
}
