
import ReactMarkdown from 'react-markdown';
import { Bot } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types';
import { SourceCitation } from './SourceCitation';

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end w-full">
        <div className="bg-[#1a1a1a] rounded-[6px] px-3 py-2 text-[13px] max-w-[85%] text-[--text-primary] whitespace-pre-wrap border border-[rgba(255,255,255,0.04)]">
          <span className="leading-relaxed font-sans">{message.content}</span>
        </div>
      </div>
    );
  }

  // UX: Von Restorff Effect — The AI response stands out with a distinct left accent border in --color-info
  return (
    <div className="w-full flex justify-start pl-3 border-l-2 border-[#3b82f6] bg-gradient-to-r from-[#3b82f6]/5 to-transparent rounded-r-[6px] py-1">
      <div className="w-full max-w-[95%] flex flex-col gap-1 text-left">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span className="font-semibold text-xs text-[--text-primary] uppercase tracking-wide">System Response</span>
        </div>
        
        <div className="text-[13px] leading-relaxed text-[--text-primary] prose prose-invert prose-p:my-1.5 prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-[rgba(255,255,255,0.06)] prose-pre:rounded-[4px] max-w-none relative">
          {message.content ? (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          ) : isStreaming ? (
            <span className="text-[--text-secondary] italic">Thinking...</span>
          ) : null}
          
          {/* UX: Zeigarnik Effect — Blinking cursor signals active incompletion during stream */}
          {isStreaming && (
            <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#3b82f6] animate-pulse align-middle" />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <SourceCitation sources={message.sources} />
        )}
      </div>
    </div>
  );
}
