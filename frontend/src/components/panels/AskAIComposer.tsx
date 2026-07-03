import { useEffect, useState, useRef } from 'react';
import { Send, Mic, Settings, Trash2 } from 'lucide-react';
import { useVoiceInput } from '../../hooks/useVoiceInput';

export type QueryStatus = 'READY' | 'PROCESSING' | 'ERROR';

interface AskAIComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
  status: QueryStatus;
  isCentered: boolean;
  tokensUsed?: number;
}

export function AskAIComposer({
  input,
  setInput,
  onSubmit,
  onClear,
  status,
  isCentered,
  tokensUsed = 0,
}: AskAIComposerProps) {
  const [flash, setFlash] = useState(false);
  const prevStatusRef = useRef<QueryStatus>(status);
  
  const { isRecording, isSupported, start, stop } = useVoiceInput((text) => {
    // Append transcribed text
    setInput(input ? `${input} ${text}` : text);
  });

  // UX: Peak-End Rule — Flash when processing finishes successfully
  useEffect(() => {
    if (prevStatusRef.current === 'PROCESSING' && status === 'READY') {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 300); // 300ms total for fade
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
  }, [status]);

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
      className={`w-full transition-all duration-300 ease-out flex flex-col bg-[#111111] border border-[rgba(255,255,255,0.06)] rounded-[8px] focus-within:border-[rgba(255,255,255,0.18)] ${
        isCentered ? 'max-w-[520px] mx-auto shadow-2xl' : 'max-w-full'
      } ${flash ? 'ring-1 ring-[#3b82f6] border-[#3b82f6]' : ''}`}
    >
      <div className="relative flex items-end p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search, summarize, or analyze vectors..."
          rows={1}
          className={`w-full resize-none bg-transparent border-0 outline-none text-[13px] text-[--text-primary] placeholder:text-[--text-tertiary] font-sans px-2 py-2 leading-relaxed transition-all ${
            isCentered ? 'min-h-[80px]' : 'min-h-[44px]'
          } max-h-[200px]`}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
          }}
        />

        {/* UX: Fitts's Law — Minimum 32px hit targets, grouped closely to text entry */}
        <div className="flex items-center gap-1.5 px-2 pb-1.5 shrink-0">
          {isSupported && (
            <button
              type="button"
              onClick={handleMicClick}
              className={`flex items-center justify-center w-8 h-8 rounded-[4px] transition-colors outline-none focus-visible:bg-[#1a1a1a] ${
                isRecording
                  ? 'text-[#ef4444] animate-pulse bg-[#ef4444]/10'
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[#1a1a1a]'
              }`}
              title="Voice Input"
            >
              <Mic className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (input.trim() && status !== 'PROCESSING') onSubmit();
            }}
            disabled={status === 'PROCESSING' || !input.trim()}
            className="flex items-center justify-center w-8 h-8 bg-white text-black rounded-[4px] hover:bg-[#e5e5e5] active:scale-[0.96] transition-all disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            title="Send Message"
          >
            {status === 'PROCESSING' ? (
              <div className="w-3.5 h-3.5 border-[2px] border-black/20 border-t-black rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Footer Status Bar: Part of the same bordered region */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]/50 rounded-b-[8px]">
        {/* UX: Hick's Law — Collapse complex config behind a single icon */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-[--text-tertiary] hover:text-[--text-secondary] transition-colors flex items-center gap-1.5"
            title="Engine Configuration (See Sidebar)"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          
          {onClear && !isCentered && (
            <button
              type="button"
              onClick={onClear}
              className="text-[#555] hover:text-[#ef4444] transition-colors flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono"
              title="Clear Conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        {/* UX: Proximity — Token count and status sit directly under composer right-aligned */}
        <div className="flex items-center gap-4 font-mono text-[10px]">
          <div className="flex items-center gap-1.5 text-[--text-secondary]">
            <span>TOKENS:</span>
            <span>~{tokensUsed}</span>
          </div>
          <div className="uppercase font-bold tracking-widest flex items-center min-w-[70px] justify-end">
            {status === 'READY' && <span className="text-[#22c55e]">[READY]</span>}
            {status === 'PROCESSING' && <span className="text-[#f59e0b] animate-pulse">[PROCESSING]</span>}
            {status === 'ERROR' && <span className="text-[#ef4444]">[ERROR]</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
