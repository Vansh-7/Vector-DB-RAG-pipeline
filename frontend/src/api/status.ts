import { apiFetch } from './client';

export interface DbStatusResponse {
  engine: string;
  metric: string;
  total_docs: number;
}

export async function getStatus(): Promise<DbStatusResponse> {
  return apiFetch<DbStatusResponse>('/status');
}
