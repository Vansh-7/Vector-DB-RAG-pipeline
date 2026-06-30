import { apiFetch } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type {
  InsertVectorRequest,
  InsertVectorResponse,
} from '../types';

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
