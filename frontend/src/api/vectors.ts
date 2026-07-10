import { apiFetch } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type {
  InsertVectorRequest,
  InsertVectorResponse,
  VectorSampleResponse,
} from '../types';

export async function getVectorSample(n: number = 2000): Promise<VectorSampleResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    const res = await apiFetch<VectorSampleResponse>(`/vectors/sample?n=${n}`);
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Fetch sample failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}

export async function insertVector(
  data: InsertVectorRequest
): Promise<InsertVectorResponse> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Inserting vector payload...` });
    const res = await apiFetch<InsertVectorResponse>('/insert', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `Vector inserted successfully.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Insert failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}

export async function clearDatabase(): Promise<{ deleted: number; message: string }> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Clearing database...` });
    const res = await apiFetch<{ deleted: number; message: string }>('/vectors/all', {
      method: 'DELETE',
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'WARNING', message: `Database cleared. ${res.deleted} items removed.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Clear DB failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}

export async function deleteVector(id: string): Promise<{ deleted: number; message: string }> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Deleting vector ${id}...` });
    const res = await apiFetch<{ deleted: number; message: string }>(`/vectors/${id}`, {
      method: 'DELETE',
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'WARNING', message: `Successfully deleted vector ${id}.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Delete failed for ${id}: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}

export async function saveDatabase(): Promise<{ message: string }> {
  const addLog = useTerminalStore.getState().addLog;
  try {
    addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Saving database to disk...` });
    const res = await apiFetch<{ message: string }>('/save', {
      method: 'POST',
    });
    addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: `Database saved successfully.` });
    return res;
  } catch (e) {
    addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Save DB failed: ${e instanceof Error ? e.message : 'Unknown'}` });
    throw e;
  }
}
