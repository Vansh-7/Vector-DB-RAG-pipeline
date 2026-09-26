export interface SearchResult {
  id: string;
  distance: number;
  category: string;
  snippet: string;
  documentId: number | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResult[];
  latencyMs: number;
  count: number;
  queryVector?: number[];
  query2d?: [number, number] | null;
}

export interface SearchParams {
  q: string;
  k?: number;
}
