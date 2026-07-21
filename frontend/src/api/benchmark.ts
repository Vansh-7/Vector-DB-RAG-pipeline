import { apiFetch } from './client';
import type { BenchmarkResponse } from '../types';

export async function getBenchmarks(q?: string): Promise<BenchmarkResponse> {
  const url = q ? `/benchmark?q=${encodeURIComponent(q)}` : '/benchmark';
  return apiFetch<BenchmarkResponse>(url);
}
