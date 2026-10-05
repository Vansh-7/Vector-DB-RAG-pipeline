import { apiFetch } from './client';
import type { Algorithm, DistanceMetric } from '../types/vector';

export interface DbStatusResponse {
  engine: Algorithm;
  metric: DistanceMetric;
  total_docs: number;
}

export async function getStatus(): Promise<DbStatusResponse> {
  return apiFetch<DbStatusResponse>('/status');
}
