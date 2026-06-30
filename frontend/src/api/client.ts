const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
export const API = `${BASE_URL}/api/v1`;

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

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "API error");
  }
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail ?? "Upload error");
  }
  return res.json() as Promise<T>;
}

export function getStreamUrl(path: string): string {
  return `${API}${path}`;
}
