import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WorkspaceView = "chat" | "documents" | "search" | "vector-lab";
export type LabView = "space" | "engine" | "benchmarks" | "maintenance";

export const SIDEBAR_WIDTH = { min: 220, default: 256, max: 360 } as const;
const clampSidebarWidth = (width: number) => Math.round(Math.min(SIDEBAR_WIDTH.max, Math.max(SIDEBAR_WIDTH.min, width)));

interface SessionState {
  activeView: WorkspaceView;
  activeConversationId: number | null;
  labView: LabView;
  isNavigationCollapsed: boolean;
  sidebarWidth: number;
  setActiveView: (view: WorkspaceView) => void;
  setActiveConversationId: (id: number | null) => void;
  openVectorLab: (view?: LabView) => void;
  setNavigationCollapsed: (collapsed: boolean) => void;
  setSidebarWidth: (width: number) => void;
  isTerminalCollapsed: boolean;
  terminalHeight: number;
  setTerminalCollapsed: (collapsed: boolean) => void;
  setTerminalHeight: (height: number) => void;
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
      sidebarWidth: SIDEBAR_WIDTH.default,
      setActiveView: (view) => set({ activeView: view }),
      setActiveConversationId: (id) => set({ activeConversationId: id }),
      openVectorLab: (view = "space") => set({ activeView: "vector-lab", labView: view }),
      setNavigationCollapsed: (collapsed) => set({ isNavigationCollapsed: collapsed }),
      setSidebarWidth: (width) => {
        if (Number.isFinite(width)) set({ sidebarWidth: clampSidebarWidth(width) });
      },
      isTerminalCollapsed: true,
      terminalHeight: 220,
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
        isNavigationCollapsed: state.isNavigationCollapsed,
        sidebarWidth: state.sidebarWidth,
        terminalHeight: state.terminalHeight,
      }),
      // Only restore layout preferences from older storage; never hydrate user content.
      merge: (persisted, current) => {
        const saved = persisted as Partial<SessionState> | null;
        return {
          ...current,
          isNavigationCollapsed: saved?.isNavigationCollapsed === true,
          sidebarWidth: typeof saved?.sidebarWidth === "number" && Number.isFinite(saved.sidebarWidth)
            ? clampSidebarWidth(saved.sidebarWidth) : current.sidebarWidth,
          terminalHeight: typeof saved?.terminalHeight === "number" && Number.isFinite(saved.terminalHeight)
            ? Math.min(520, Math.max(120, saved.terminalHeight)) : current.terminalHeight,
        };
      },
    }
  )
);
