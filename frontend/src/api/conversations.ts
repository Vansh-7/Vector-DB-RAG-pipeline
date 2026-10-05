import { apiFetch } from "./client";
import type { ConversationMessageRecord, ConversationRecord, DeleteConversationResponse } from "../types/conversation";

export const conversationKeys = {
  list: (userId: number | undefined) => ["conversations", userId] as const,
  messages: (userId: number | undefined, conversationId: number | null) => ["conversationMessages", userId, conversationId] as const,
};

export function listConversations(): Promise<ConversationRecord[]> {
  return apiFetch("/conversations");
}

export function listConversationMessages(id: number): Promise<ConversationMessageRecord[]> {
  return apiFetch(`/conversations/${id}/messages`);
}

export function renameConversation(id: number, title: string): Promise<ConversationRecord> {
  return apiFetch(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) });
}

export function deleteConversation(id: number): Promise<DeleteConversationResponse> {
  return apiFetch(`/conversations/${id}`, { method: "DELETE" });
}
