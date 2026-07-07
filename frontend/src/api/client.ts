const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
// Ensure BASE_URL doesn't end with a slash to prevent double-slashes
const cleanBaseUrl = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
export const API = `${cleanBaseUrl}/api/v1`;

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function parseErrorDetail(err: any, defaultMsg: string): string {
  if (!err?.detail) return defaultMsg;
  if (typeof err.detail === 'string') return err.detail;
  if (Array.isArray(err.detail)) {
    return err.detail.map((e: any) => `${e.loc?.join('.')} - ${e.msg}`).join(', ');
  }
  return JSON.stringify(err.detail);
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Prevent double slashes by cleaning the path
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  const res = await fetch(`${API}${cleanPath}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, parseErrorDetail(err, "API error"));
  }
  return res.json() as Promise<T>;
}

export function getStreamUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API}${cleanPath}`;
}
