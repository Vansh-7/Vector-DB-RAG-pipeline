import { apiFetch, apiUpload } from './client';
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
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Uploading file: ${file.name}` });
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    const res = await apiUpload<IngestResponse>('/ingest/file', formData);
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `File ingested successfully.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `File upload failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
