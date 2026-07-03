import { getStreamUrl } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';


export async function askQuestion(
  question: string,
  k: number,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void
): Promise<void> {
  const addLog = useTerminalStore.getState().addLog;
  addLog({ timestamp: getCurrentTimestamp(), level: 'INFO', message: `Streaming RAG Query: "${question}"` });

  try {
    const url = getStreamUrl('/ask');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, k }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      onError(err.detail ?? 'Request failed');
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError('No response body');
      return;
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: 'RAG Stream complete.' });
        onDone();
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      console.log('[ASK DEBUG] raw chunk received:', JSON.stringify(chunk));
      onToken(chunk);
    }
  } catch (e) {
    console.error('[ASK DEBUG] stream error:', e);
    onError(e instanceof Error ? e.message : String(e));
  }
}
