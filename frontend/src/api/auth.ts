import { apiFetch } from "./client";
import type { AuthUser } from "../store/authStore";

interface Credentials {
  email: string;
  password: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export function register(credentials: Credentials): Promise<AuthUser> {
  return apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function login(credentials: Credentials): Promise<TokenResponse> {
  return apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export function getMe(token?: string, signal?: AbortSignal): Promise<AuthUser> {
  return apiFetch("/auth/me", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    signal,
  });
}
