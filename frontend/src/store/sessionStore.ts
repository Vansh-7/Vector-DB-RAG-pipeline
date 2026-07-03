import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "../types";

export type ActiveTab = "ask-ai" | "ingest" | "search" | "benchmarks";

interface SessionState {
  isSidebarCollapsed: boolean;
  isTerminalCollapsed: boolean;
  terminalHeight: number;
  setTerminalCollapsed: (collapsed: boolean) => void;
  setTerminalHeight: (height: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activeTab: ActiveTab;
  chatHistory: ChatMessage[];
  setActiveTab: (tab: ActiveTab) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearChat: () => void;

  // Search Panel State
  searchInputValue: string;
  setSearchInputValue: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  searchDismissedIds: string[];
  setSearchDismissedIds: (ids: string[]) => void;

  // Ask AI Panel State
  askAiInput: string;
  setAskAiInput: (val: string) => void;

  // Ingest Panel State
  ingestMode: "file" | "manual";
  setIngestMode: (val: "file" | "manual") => void;
  ingestTitle: string;
  setIngestTitle: (val: string) => void;
  ingestDescription: string;
  setIngestDescription: (val: string) => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      activeTab: "search",
      isSidebarCollapsed: false,
      isTerminalCollapsed: false,
      terminalHeight: 220,
      chatHistory: [],
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setTerminalCollapsed: (collapsed) => set({ isTerminalCollapsed: collapsed }),
      setTerminalHeight: (height) => set({ terminalHeight: height }),
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

      searchInputValue: "",
      setSearchInputValue: (val) => set({ searchInputValue: val }),
      searchQuery: "",
      setSearchQuery: (val) => set({ searchQuery: val }),
      searchDismissedIds: [],
      setSearchDismissedIds: (ids) => set({ searchDismissedIds: ids }),

      askAiInput: "",
      setAskAiInput: (val) => set({ askAiInput: val }),

      ingestMode: "manual",
      setIngestMode: (val) => set({ ingestMode: val }),
      ingestTitle: "",
      setIngestTitle: (val) => set({ ingestTitle: val }),
      ingestDescription: "",
      setIngestDescription: (val) => set({ ingestDescription: val }),
    }),
    {
      name: "vectordb-session-storage",
      partialize: (state) => ({ 
        activeTab: state.activeTab, 
        isSidebarCollapsed: state.isSidebarCollapsed, 
        isTerminalCollapsed: state.isTerminalCollapsed, 
        terminalHeight: state.terminalHeight,
        chatHistory: state.chatHistory,
        searchInputValue: state.searchInputValue,
        searchQuery: state.searchQuery,
        searchDismissedIds: state.searchDismissedIds,
        askAiInput: state.askAiInput,
        ingestMode: state.ingestMode,
        ingestTitle: state.ingestTitle,
        ingestDescription: state.ingestDescription
      }),
    }
  )
);
