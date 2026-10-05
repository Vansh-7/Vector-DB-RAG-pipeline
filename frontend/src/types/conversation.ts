import type { RAGSource } from "./rag";

export interface ConversationRecord {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationMessageRecord {
  id: number;
  conversation_id: number;
  role: "user" | "assistant";
  content: string;
  sources: RAGSource[] | null;
  created_at: string;
}

export interface DeleteConversationResponse {
  deleted_conversation_id: number;
}
