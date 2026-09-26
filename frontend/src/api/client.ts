import { getSessionSignal, useAuthStore } from "../store/authStore";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// Ensure BASE_URL doesn't end with a slash to prevent double-slashes
const cleanBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
export const API = `${cleanBaseUrl}/api/v1`;

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function parseErrorDetail(err: unknown, defaultMsg: string): string {
  if (!err || typeof err !== "object" || !("detail" in err)) return defaultMsg;
  const detail = err.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => `${e.loc?.join(".")} - ${e.msg}`).join(", ");
  }
  return JSON.stringify(detail);
}

export async function apiRequest(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(options?.headers);
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
  if (options?.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const requestToken = headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const signal = token && requestToken === token
    ? options?.signal ? AbortSignal.any([options.signal, getSessionSignal()]) : getSessionSignal()
    : options?.signal;

  const res = await fetch(`${API}${cleanPath}`, {
    ...options,
    headers,
    signal,
  });
  if (res.status === 401 && requestToken && useAuthStore.getState().accessToken === requestToken) {
    useAuthStore.getState().expireSession();
  }
  return res;
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await apiRequest(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, parseErrorDetail(err, "API error"));
  }
  return res.json() as Promise<T>;
}
