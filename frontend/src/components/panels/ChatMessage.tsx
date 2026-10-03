
import ReactMarkdown from 'react-markdown';
import { BrandMark } from '../ui/BrandMark';
import type { ChatMessage as ChatMessageType } from '../../types';
import type { RAGSource } from '../../types';
import { SourceCitation } from './SourceCitation';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
  onInspectSources?: (sources: RAGSource[], trigger: HTMLButtonElement) => void;
}

export function ChatMessage({ message, isStreaming, onInspectSources }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end w-full">
        <div className="bg-elevated rounded-lg px-4 py-3 text-body max-w-[85%] text-[--text-primary] whitespace-pre-wrap break-words">
          <span className="leading-relaxed font-sans">{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-start py-1">
      <div className="w-full min-w-0 flex flex-col text-left">
        <div className="flex items-center gap-2 mb-3">
          <BrandMark className="h-[18px] w-[18px]" />
          <span className="font-medium text-sm text-[--text-secondary]">Neuebit</span>
        </div>
        
        <div className="markdown max-w-[65ch] text-[15px] leading-[1.75] text-[--text-primary] relative">
          {message.content ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : isStreaming ? (
            <span className="text-[--text-secondary] italic">Thinking...</span>
          ) : null}
          
          {/* UX: Zeigarnik Effect — Blinking cursor signals active incompletion during stream */}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-[--color-info] animate-pulse align-middle" />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <SourceCitation sources={message.sources} onInspect={onInspectSources} />
        )}
      </div>
    </div>
  );
}
