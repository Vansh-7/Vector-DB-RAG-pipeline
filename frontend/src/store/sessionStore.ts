import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ActiveTab = "ask-ai" | "ingest" | "search" | "benchmarks";
export type WorkspaceView = "chat" | "documents" | "search" | "vector-lab";
export type LabView = "space" | "engine" | "benchmarks" | "maintenance";

interface SessionState {
  activeView: WorkspaceView;
  activeConversationId: number | null;
  labView: LabView;
  isNavigationCollapsed: boolean;
  setActiveView: (view: WorkspaceView) => void;
  setActiveConversationId: (id: number | null) => void;
  openVectorLab: (view?: LabView) => void;
  setNavigationCollapsed: (collapsed: boolean) => void;
  isSidebarCollapsed: boolean;
  isTerminalCollapsed: boolean;
  terminalHeight: number;
  setTerminalCollapsed: (collapsed: boolean) => void;
  setTerminalHeight: (height: number) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  resetForAuthChange: () => void;

  // Search Panel State
  searchInputValue: string;
  setSearchInputValue: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;

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
      activeConversationId: null,
      labView: "space",
      isNavigationCollapsed: false,
      setActiveView: (view) => set({ activeView: view }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      openVectorLab: (view = "space") => set({ activeView: "vector-lab", labView: view }),
      setNavigationCollapsed: (collapsed) => set({ isNavigationCollapsed: collapsed }),
      activeTab: "search",
      isSidebarCollapsed: false,
      isTerminalCollapsed: true,
      terminalHeight: 220,
      setActiveTab: (tab) => set({ activeTab: tab }),
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setTerminalCollapsed: (collapsed) => set({ isTerminalCollapsed: collapsed }),
      setTerminalHeight: (height) => set({ terminalHeight: height }),
      resetForAuthChange: () => set({
        activeView: "chat",
        activeConversationId: null,
        labView: "space",
        isTerminalCollapsed: true,
        searchInputValue: "",
        searchQuery: "",
        askAiInput: "",
        ingestMode: "manual",
        ingestTitle: "",
        ingestDescription: "",
      }),

      searchInputValue: "",
      setSearchInputValue: (val) => set({ searchInputValue: val }),
      searchQuery: "",
      setSearchQuery: (val) => set({ searchQuery: val }),

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
