import { apiFetch } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type { SearchParams, SearchResponse } from '../types';

export async function search(params: SearchParams): Promise<SearchResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    const start = performance.now();
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Searching for: "${params.q}"` });

    // Using the new /search/text endpoint
    const response = await apiFetch<any>('/search/text', {
      method: 'POST',
      body: JSON.stringify({ text: params.q, k: params.k ?? 5 })
    });

    const latencyMs = performance.now() - start;
    const resultsArray = response.results ?? [];
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `Search complete. Found ${resultsArray.length} results in ${latencyMs.toFixed(1)}ms` });

    return {
      query: params.q,
      results: resultsArray.map((r: any) => ({
        id: r.id.toString(),
        score: r.distance,
        category: r.category,
        snippet: r.metadata,
        x: 0,
        y: 0
      })),
      latencyMs,
      algorithm: params.algorithm ?? 'hnsw',
      count: resultsArray.length,
      queryVector: response.query_vector
    };
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Search failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
