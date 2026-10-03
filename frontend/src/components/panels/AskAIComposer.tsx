import { ArrowUp, Mic, Settings, Square } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';
import { useSessionStore } from '../../store/sessionStore';

export type QueryStatus = 'READY' | 'PROCESSING' | 'ERROR';

interface AskAIComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  status: QueryStatus;
  isCentered: boolean;
}

export function AskAIComposer({
  input,
  setInput,
  onSubmit,
  onCancel,
  status,
  isCentered,
}: AskAIComposerProps) {
  const openVectorLab = useSessionStore((s) => s.openVectorLab);

  const { isRecording, isSupported, start, stop } = useVoiceInput((text) => {
    // Append transcribed text
    setInput(input ? `${input} ${text}` : text);
  });


  // UX: Jakob's Law — Enter to send, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // UX: Postel's Law — Gracefully ignore empty submits
      if (input.trim() && status !== 'PROCESSING') {
        onSubmit();
      }
    }
  };

  const handleMicClick = () => {
    if (isRecording) {
      stop();
    } else {
      start();
    }
  };

  // UX: Law of Common Region — All controls and status live in one grouped bounded box
  return (
    <div
      className="w-full flex flex-col bg-[--bg-composer] border border-[--border-subtle] rounded-lg transition-colors focus-within:border-[--border-strong] focus-within:ring-1 focus-within:ring-[--border-subtle]"
    >
      <div className="px-5 pt-4">
        <textarea
          aria-label="Ask a question about your knowledge"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents…"
          rows={1}
          className={`w-full resize-none bg-transparent border-0 outline-none text-body text-[--text-primary] placeholder:text-[--text-placeholder] font-sans py-1 leading-relaxed ${
            isCentered ? 'min-h-[88px]' : 'min-h-[44px]'
          } max-h-[200px]`}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
        />

      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-4 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" className="icon-button h-7 w-7" title="Engine configuration in Vector Lab" aria-label="Open Vector Lab engine settings" onClick={() => openVectorLab('engine')}><Settings className="h-3.5 w-3.5" /></button>
          <span role="status" className={`text-xs ${status === 'ERROR' ? 'text-error' : 'text-[--text-tertiary]'}`}>{status === 'PROCESSING' ? 'Generating answer…' : status === 'ERROR' ? 'Try again' : 'Answers from your documents'}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {isSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              aria-label={isRecording ? "Stop voice input" : "Start voice input"}
              className={`icon-button ${
                isRecording
                  ? 'text-[--color-error] animate-pulse bg-error/10'
                  : ''
              }`}
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => status === 'PROCESSING' ? onCancel?.() : input.trim() && onSubmit()}
            disabled={status !== 'PROCESSING' && !input.trim()}
            className="flex items-center justify-center w-8 h-8 bg-[--primary-action] text-[--text-inverse] rounded hover:bg-[--primary-action-hover] active:bg-[--primary-action-active] transition-colors disabled:opacity-30 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[--color-info] focus-visible:ring-offset-2 focus-visible:ring-offset-[--bg-elevated]"
            title={status === 'PROCESSING' ? 'Stop answer' : 'Send message'}
            aria-label={status === 'PROCESSING' ? 'Stop answer' : 'Send message'}
          >
            {status === 'PROCESSING' ? (
              <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            ) : (
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

    </div>
  );
}
