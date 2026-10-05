import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "../api/documents";
import { useAuthStore } from "../store/authStore";
import type { DocumentRecord } from "../types/document";

export function useDocuments(pollProcessing = false) {
  const userId = useAuthStore((s) => s.user?.id);
  return useQuery<DocumentRecord[]>({
    queryKey: ["documents", userId],
    queryFn: listDocuments,
    enabled: userId !== undefined,
    refetchInterval: pollProcessing
      ? (query) => query.state.data?.some((document) => document.status === "processing" || document.status === "deleting") ? 2_000 : false
      : false,
  });
}
