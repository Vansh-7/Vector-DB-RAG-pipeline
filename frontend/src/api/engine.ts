import { apiFetch } from './client';

export async function configureEngine(algorithm: string, metric: string): Promise<{ algorithm: string; metric: string; total_docs: number }> {
  return apiFetch(`/engine/configure?algorithm=${algorithm}&metric=${metric}`, {
    method: 'POST',
  });
}
