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
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Uploading file: ${file.name}...` });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);

    // Cannot use standard apiFetch because it forces application/json Content-Type
    const res = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"}/api/v1/ingest/file`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? "File upload error");
    }

    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `File ingested successfully.` });
    return res.json() as Promise<IngestResponse>;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `File upload failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
