import { apiFetch } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type { Category, IngestRequest, IngestResponse } from '../types';

export async function ingestDocument(
  data: IngestRequest
): Promise<IngestResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Ingesting document...` });
    const res = await apiFetch<IngestResponse>('/ingest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `Document ingested successfully.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Ingest failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}

export async function ingestFile(
  file: File,
  category: Category
): Promise<IngestResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Reading file: ${file.name}` });
    const text = await file.text();
    const res = await apiFetch<IngestResponse>('/ingest', {
      method: 'POST',
      body: JSON.stringify({ text, category }),
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `File ingested successfully.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `File upload failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
