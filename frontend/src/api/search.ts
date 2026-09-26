import { apiFetch } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type { SearchParams, SearchResponse } from '../types';

interface TextSearchPayload {
  results: { id: string; distance: number; metadata: string; category: string; document_id: number | null }[];
  query_vector: number[];
  query_2d: number[] | null;
}

export async function search(params: SearchParams): Promise<SearchResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    const start = performance.now();
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Searching for: "${params.q}"` });

    const response = await apiFetch<TextSearchPayload>('/search/text', {
      method: 'POST',
      body: JSON.stringify({ text: params.q, k: params.k ?? 5 })
    });

    const latencyMs = performance.now() - start;
    const resultsArray = response.results ?? [];
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `Search complete. Found ${resultsArray.length} results in ${latencyMs.toFixed(1)}ms` });

    return {
      query: params.q,
      results: resultsArray.map((r) => ({
        id: String(r.id),
        distance: r.distance,
        category: r.category,
        snippet: r.metadata,
        documentId: r.document_id ?? null,
      })),
      latencyMs,
      count: resultsArray.length,
      queryVector: response.query_vector,
      query2d: response.query_2d?.length === 2 ? [response.query_2d[0], response.query_2d[1]] : null,
    };
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Search failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
