import { useQuery } from "@tanstack/react-query";
import { conversationKeys, listConversationMessages, listConversations } from "../api/conversations";
import { useAuthStore } from "../store/authStore";

export function useConversations() {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: conversationKeys.list(userId),
    queryFn: listConversations,
    enabled: userId !== undefined,
  });
}

export function useConversationMessages(id: number | null, enabled = true) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery({
    queryKey: conversationKeys.messages(userId, id),
    queryFn: () => listConversationMessages(id!),
    enabled: userId !== undefined && id !== null && enabled,
  });
}
