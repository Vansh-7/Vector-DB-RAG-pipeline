import { apiFetch } from './client';
import type { BenchmarkResponse } from '../types';

export async function getBenchmarks(): Promise<BenchmarkResponse> {
  return apiFetch<BenchmarkResponse>('/benchmark');
}
