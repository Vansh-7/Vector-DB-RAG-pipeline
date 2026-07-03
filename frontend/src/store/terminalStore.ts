import { create } from "zustand";
import type { LogEntry } from "../types";

type ConnectionStatus = "connected" | "offline" | "connecting";

interface TerminalState {
  logs: LogEntry[];
  status: ConnectionStatus;
  addLog: (log: Omit<LogEntry, "id">) => void;
  setStatus: (status: ConnectionStatus) => void;
  clear: () => void;
}

export const useTerminalStore = create<TerminalState>()((set) => ({
  logs: [],
  status: "connecting",
  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, { ...log, id: Math.random().toString(36).substring(7) } as LogEntry].slice(-500),
    })),
  setStatus: (status) => set({ status }),
  clear: () => set({ logs: [] }),
}));
