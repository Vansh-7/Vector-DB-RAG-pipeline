import { apiFetch } from './client';
import type { Algorithm, DistanceMetric } from '../types/vector';

export async function configureEngine(algorithm: Algorithm, metric: DistanceMetric): Promise<{ algorithm: Algorithm; metric: DistanceMetric; total_docs: number }> {
  return apiFetch(`/engine/configure?algorithm=${algorithm}&metric=${metric}`, {
    method: 'POST',
  });
}
