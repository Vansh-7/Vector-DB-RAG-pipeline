import { useState, useRef, useEffect } from 'react';
import { Sparkles, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';
import { useEngineStore } from '../../store/engineStore';
import { useCanvasStore } from '../../store/canvasStore';
import { useTerminalStore } from '../../store/terminalStore';
import { askQuestion } from '../../api/query';
import { generateId, getCurrentTimestamp } from '../../lib/utils';
import ReactMarkdown from 'react-markdown';

type QueryStatus = 'READY' | 'PROCESSING' | 'ERROR';

function stripThinking(text: string): string {
  let result = text.replace(/<thinking>[\s\S]*?<\/thinking>/g, '');
  const openIdx = result.indexOf('<thinking>');
  if (openIdx !== -1) {
    result = result.slice(0, openIdx);
  }
  return result;
}

export function AskAIPanel() {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<QueryStatus>('READY');
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});

  const messages = useSessionStore((s) => s.chatHistory);
  const addMessage = useSessionStore((s) => s.addMessage);
  const updateMessage = useSessionStore((s) => s.updateMessage);

  const addLog = useTerminalStore((s) => s.addLog);
  const algorithm = useEngineStore((s) => s.algorithm);
  const metric = useEngineStore((s) => s.metric);
  const topK = useEngineStore((s) => s.topK);
  const setHighlighted = useCanvasStore((s) => s.setHighlighted);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, messages[messages.length - 1]?.content]);

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

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

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Scrollable Chat History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-50 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-[#555]" />
            <p className="text-sm font-medium text-[#888]">How can I help you explore the Vector Space?</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div className="bg-[#222] border border-[rgba(255,255,255,0.06)] rounded-lg rounded-br-sm px-4 py-2.5 text-sm max-w-[85%] text-[#f4f4f4] whitespace-pre-wrap shadow-sm">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2 w-full max-w-[95%]">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-gradient-to-tr from-[#a78bfa] to-[#3b82f6] flex items-center justify-center shrink-0 shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-xs font-semibold text-[#f4f4f4]">Nabla AI</span>
                </div>
                <div className="bg-[#111] border border-[rgba(255,255,255,0.06)] rounded-lg rounded-tl-sm p-4 shadow-sm">
                  <div className="text-sm leading-relaxed text-[#d4d4d4] prose prose-invert prose-p:my-1 prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-[rgba(255,255,255,0.06)] prose-pre:rounded-md max-w-none">
                    {msg.content ? <ReactMarkdown>{msg.content}</ReactMarkdown> : <span className="animate-pulse opacity-50">Thinking...</span>}
                  </div>

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="border-t border-[rgba(255,255,255,0.06)] mt-4 pt-3">
                      <button
                        onClick={() => toggleSources(msg.id)}
                        className="flex items-center gap-1.5 text-xs font-medium text-[#888] hover:text-[#f4f4f4] transition-colors outline-none"
                      >
                        Sources Referenced ({msg.sources.length})
                        {expandedSources[msg.id] ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {expandedSources[msg.id] && (
                        <div className="mt-3 space-y-2">
                          {msg.sources.map((src, i) => (
                            <div
                              key={`${src.vectorId}-${i}`}
                              onClick={() => setHighlighted([src.vectorId])}
                              className="group flex flex-col gap-1 py-1.5 px-2.5 rounded-md bg-[#161616] border border-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono text-xs text-[#a78bfa] group-hover:underline">
                                  {src.vectorId}
                                </span>
                                <span
                                  className="font-mono text-xs font-semibold"
                                  style={{
                                    color: src.score >= 0.9 ? '#22c55e' : src.score >= 0.7 ? '#f59e0b' : '#ef4444',
                                  }}
                                >
                                  {src.score.toFixed(3)}
                                </span>
                              </div>
                              <p className="text-xs text-[#555] line-clamp-1">{src.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0a0a0a] border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="relative flex flex-col gap-3 bg-[#111] border border-[rgba(255,255,255,0.1)] focus-within:border-[rgba(255,255,255,0.2)] rounded-lg p-3 shadow-sm transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your vectors... (Enter to send)"
            rows={2}
            className="w-full resize-none bg-transparent border-0 outline-none text-sm text-[#f4f4f4] placeholder:text-[#666] leading-relaxed"
          />
          <div className="flex items-center justify-between pt-1">
            <span className="text-2xs font-mono text-[#555] opacity-0 focus-within:opacity-100 transition-opacity">
              Press Enter ↵
            </span>
            <button
              onClick={handleSubmit}
              disabled={status === 'PROCESSING' || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#f4f4f4] text-[#0a0a0a] text-xs font-semibold rounded-md hover:bg-[#e5e5e5] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none shadow-sm"
            >
              {status === 'PROCESSING' ? (
                <>
                  <div className="w-3 h-3 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin" />
                  Thinking
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Ask
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
