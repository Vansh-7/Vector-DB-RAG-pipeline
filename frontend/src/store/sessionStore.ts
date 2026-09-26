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
        isNavigationCollapsed: state.isNavigationCollapsed,
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
      // Ignore the old expanded-terminal preference without migrating chat data.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<SessionState>),
        activeView: "chat",
        labView: "space",
        isTerminalCollapsed: true,
      }),
    }
  )
);
