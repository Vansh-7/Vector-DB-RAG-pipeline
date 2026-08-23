import { getStreamUrl } from './client';
import { useTerminalStore } from '../store/terminalStore';
import { getCurrentTimestamp } from '../lib/utils';
import type { RAGSource } from '../types';

export async function askQuestion(
  question: string,
  k: number,
  onToken: (token: string) => void,
  onSources: (sources: RAGSource[]) => void,
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
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer.trim()) {
          // Process any remaining buffer
          try {
            const parsed = JSON.parse(buffer);
            if (parsed.type === 'sources') {
              onSources(parsed.data);
            } else if (parsed.type === 'token') {
              onToken(parsed.data);
            }
          } catch (e) {
            console.warn('[ASK DEBUG] Failed to parse final JSON line:', buffer);
            onToken(buffer);
          }
        }
        addLog({ timestamp: getCurrentTimestamp(), level: 'SUCCESS', message: 'RAG Stream complete.' });
        onDone();
        break;
      }
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last incomplete line in the buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'sources') {
            onSources(parsed.data);
          } else if (parsed.type === 'token') {
            onToken(parsed.data);
          } else if (parsed.type === 'error') {
            onError(parsed.data);
          }
        } catch (e) {
          console.warn('[ASK DEBUG] Failed to parse JSON line:', line);
          onToken(line + '\n');
        }
      }
    }
  } catch (e) {
    console.error('[ASK DEBUG] stream error:', e);
    onError(e instanceof Error ? e.message : String(e));
  }
}
