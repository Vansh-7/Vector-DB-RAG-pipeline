import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage } from "../types";

export type ActiveTab = "ask-ai" | "ingest" | "search" | "benchmarks";
export type WorkspaceView = "chat" | "documents" | "search" | "vector-lab";
export type LabView = "space" | "engine" | "benchmarks" | "maintenance";

interface SessionState {
  activeView: WorkspaceView;
  labView: LabView;
  isNavigationCollapsed: boolean;
  setActiveView: (view: WorkspaceView) => void;
  openVectorLab: (view?: LabView) => void;
  setNavigationCollapsed: (collapsed: boolean) => void;
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
  resetForAuthChange: () => void;

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
      // Shell navigation is transient; opening the app always starts in Chat.
      activeView: "chat",
      labView: "space",
      isNavigationCollapsed: false,
      setActiveView: (view) => set({ activeView: view }),
      openVectorLab: (view = "space") => set({ activeView: "vector-lab", labView: view }),
      setNavigationCollapsed: (collapsed) => set({ isNavigationCollapsed: collapsed }),
      activeTab: "search",
      isSidebarCollapsed: false,
      isTerminalCollapsed: true,
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
      resetForAuthChange: () => set({
        activeView: "chat",
        labView: "space",
        isTerminalCollapsed: true,
        chatHistory: [],
        searchInputValue: "",
        searchQuery: "",
        searchDismissedIds: [],
        askAiInput: "",
        ingestMode: "manual",
        ingestTitle: "",
        ingestDescription: "",
      }),

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
        isSidebarCollapsed: state.isSidebarCollapsed,
        isNavigationCollapsed: state.isNavigationCollapsed,
        terminalHeight: state.terminalHeight,
      }),
      // Only restore layout preferences from older storage; never hydrate user content.
      merge: (persisted, current) => {
        const saved = persisted as Partial<SessionState> | null;
        return {
          ...current,
          isSidebarCollapsed: saved?.isSidebarCollapsed === true,
          isNavigationCollapsed: saved?.isNavigationCollapsed === true,
          terminalHeight: typeof saved?.terminalHeight === "number" ? saved.terminalHeight : current.terminalHeight,
        };
      },
    }
  )
);
