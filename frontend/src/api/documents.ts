import { apiFetch } from "./client";
import type { DeleteDocumentResponse, DocumentRecord } from "../types/document";

export function listDocuments(): Promise<DocumentRecord[]> {
  return apiFetch("/documents");
}

export function deleteDocument(id: number): Promise<DeleteDocumentResponse> {
  return apiFetch(`/documents/${id}`, { method: "DELETE" });
}
