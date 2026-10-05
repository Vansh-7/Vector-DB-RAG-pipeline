export interface DocumentRecord {
  id: number;
  name: string;
  category: string;
  source_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface DeleteDocumentResponse {
  deleted_document_id: number;
  deleted_chunks: number;
}
