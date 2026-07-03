import { useRef, useEffect, useState } from 'react';
import { useSessionStore } from "../../store/sessionStore";
import { useEngineStore } from '../../store/engineStore';
import { useTerminalStore } from '../../store/terminalStore';
import { askQuestion } from '../../api/query';
import { generateId, getCurrentTimestamp } from '../../lib/utils';
import { AskAIComposer } from './AskAIComposer';
import type { QueryStatus } from './AskAIComposer';
import { ChatMessage } from './ChatMessage';
import { AskAIPromptChips } from './AskAIPromptChips';

function stripThinking(text: string): string {
  let result = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  const openIdx = result.indexOf('<thinking>');
  if (openIdx !== -1) {
    result = result.slice(0, openIdx);
  }
  return result;
}

export function AskAIPanel() {
  const [status, setStatus] = useState<QueryStatus>('READY');
  const input = useSessionStore((s) => s.askAiInput);
  const setInput = useSessionStore((s) => s.setAskAiInput);

  const messages = useSessionStore((s) => s.chatHistory);
  const clearChat = useSessionStore((s) => s.clearChat);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateMessage = useSessionStore((s) => s.updateMessage);

  const addLog = useTerminalStore((s) => s.addLog);
  const topK = useEngineStore((s) => s.topK);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, messages[messages.length - 1]?.content]);

  // UX: Doherty Threshold — Synchronous UI update on submit before the network trip
  const handleSubmit = async () => {
    if (!input.trim() || status === 'PROCESSING') return;

    const query = input.trim();
    setInput('');
    setStatus('PROCESSING');

    const userMsgId = generateId();
    addMessage({
      id: userMsgId,
      role: 'user',
      content: query,
      timestamp: getCurrentTimestamp(),
    });

    const assistantMsgId = generateId();
    addMessage({
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: getCurrentTimestamp(),
      sources: []
    });

    let accumulated = '';

    await askQuestion(
      query,
      topK,
      (token) => {
        accumulated += token;
        const visibleText = stripThinking(accumulated);
        updateMessage(assistantMsgId, { content: visibleText });
      },
      () => {
        const finalText = stripThinking(accumulated);
        updateMessage(assistantMsgId, { content: finalText });
        setStatus('READY');
      },
      (err) => {
        addLog({ timestamp: getCurrentTimestamp(), level: 'ERROR', message: `Ask AI failed: ${err}` });
        updateMessage(assistantMsgId, {
          content: `Error: ${err}`,
        });
        setStatus('ERROR');
        setTimeout(() => setStatus('READY'), 3000);
      }
    );
  };

  const handleChipSelect = (prompt: string) => {
    setInput(prompt);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {messages.length === 0 ? (
        // Empty State: Jakob's Law & Hick's Law — No mascots, just the composer and a few chips
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-lg font-medium text-[--text-primary] mb-6">
            Query your vector space.
          </h2>
          <div className="w-full max-w-[520px]">
            <AskAIComposer
              input={input}
              setInput={setInput}
              onSubmit={handleSubmit}
              status={status}
              isCentered={true}
              tokensUsed={0}
            />
            <AskAIPromptChips onSelect={handleChipSelect} />
          </div>
        </div>
      ) : (
        // Active State
        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 pt-14 custom-scrollbar">
            {messages.map((msg, i) => {
              const isLast = i === messages.length - 1;
              const isStreaming = status === 'PROCESSING' && msg.role === 'assistant' && isLast;
              return (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isStreaming={isStreaming}
                />
              );
            })}
            <div ref={messagesEndRef} className="h-4" />
          </div>

          <div className="shrink-0 p-4 pt-2">
            <div className="max-w-3xl mx-auto">
              <AskAIComposer
                input={input}
                setInput={setInput}
                onSubmit={handleSubmit}
                status={status}
                isCentered={false}
                onClear={clearChat}
                // Placeholder for tokens - backend needs to supply this
                tokensUsed={42}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
