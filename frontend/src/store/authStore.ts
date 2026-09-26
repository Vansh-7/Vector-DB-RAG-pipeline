import { create } from "zustand";
import { queryClient } from "../lib/queryClient";
import { useCanvasStore } from "./canvasStore";
import { useSessionStore } from "./sessionStore";
import { useTerminalStore } from "./terminalStore";

export interface AuthUser {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "verification-error";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  signIn: (token: string, user: AuthUser) => void;
  logout: () => void;
  expireSession: () => void;
  verificationFailed: (message: string) => void;
  retryVerification: () => void;
  clearError: () => void;
}

const TOKEN_KEY = "kernspace-access-token";
let sessionController = new AbortController();

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // The session remains usable in memory if browser storage is unavailable.
  }
}

function clearPrivateState() {
  sessionController.abort();
  sessionController = new AbortController();
  queryClient.clear();
  useSessionStore.getState().resetForAuthChange();
  useCanvasStore.getState().clearAll();
  useTerminalStore.getState().resetForAuthChange();
}

export function getSessionSignal(): AbortSignal {
  return sessionController.signal;
}

const initialToken = readToken();
// Sanitize any pre-auth legacy drafts/history before an account is verified.
clearPrivateState();

export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: initialToken,
  user: null,
  status: initialToken ? "checking" : "unauthenticated",
  error: null,
  signIn: (token, user) => {
    clearPrivateState();
    storeToken(token);
    set({ accessToken: token, user, status: "authenticated", error: null });
  },
  logout: () => {
    clearPrivateState();
    storeToken(null);
    set({ accessToken: null, user: null, status: "unauthenticated", error: null });
  },
  expireSession: () => {
    clearPrivateState();
    storeToken(null);
    set({ accessToken: null, user: null, status: "unauthenticated", error: "Your session expired. Sign in again." });
  },
  verificationFailed: (message) => set({ status: "verification-error", error: message }),
  retryVerification: () => set({ status: "checking", error: null }),
  clearError: () => set({ error: null }),
}));
