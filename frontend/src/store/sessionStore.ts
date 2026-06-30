import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "../types";

export type ActiveTab = "ask-ai" | "ingest" | "search" | "benchmarks";

interface SessionState {
  activeTab: ActiveTab;
  chatHistory: ChatMessage[];
  setActiveTab: (tab: ActiveTab) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChat: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeTab: "ask-ai",
      chatHistory: [],
      setActiveTab: (tab) => set({ activeTab: tab }),
      addMessage: (message) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, message],
        })),
      updateMessage: (id, updates) =>
        set((state) => ({
          chatHistory: state.chatHistory.map((msg) =>
            msg.id === id ? { ...msg, ...updates } : msg
          ),
        })),
      clearChat: () => set({ chatHistory: [] }),
    }),
    {
      name: "vectordb-session-storage",
      partialize: (state) => ({ activeTab: state.activeTab }),
    }
  )
);
