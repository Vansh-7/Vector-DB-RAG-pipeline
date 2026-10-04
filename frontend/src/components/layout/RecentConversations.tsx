import { useRef } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { useConversations } from "../../hooks/useConversations";
import { useSessionStore } from "../../store/sessionStore";
import { ConversationActions } from "./ConversationActions";

export function RecentConversations({ chatBusy, onSelect }: { chatBusy: boolean; onSelect: (id: number) => void }) {
  const activeId = useSessionStore((s) => s.activeConversationId);
  const query = useConversations();
  const refreshRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="mx-2.5 mt-7 border-t border-[--border-subtle] pt-4 min-w-0">
      <div className="flex items-center justify-between px-2 mb-2">
        <h2 className="text-2xs text-[--text-tertiary]">Recent chats</h2>
        <button ref={refreshRef} type="button" onClick={() => void query.refetch()} title="Refresh chats" aria-label="Refresh chats" className="rounded p-1 text-[--text-tertiary] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      {query.isPending ? <div aria-label="Loading recent chats" className="px-2 py-3 text-xs text-[--text-secondary] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading chats</div>
        : query.isError ? <div className="px-2 py-2 text-xs text-error">Could not load chats. <button type="button" onClick={() => void query.refetch()} className="underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error">Retry</button></div>
          : query.data.length === 0 ? <p className="px-2 py-2 text-xs leading-relaxed text-[--text-secondary]">Your conversations will appear here after your first question.</p>
            : <ul className="space-y-0.5">
              {query.data.map((conversation) => (
                <li key={conversation.id} className="relative group min-w-0">
                  <button type="button" onClick={() => onSelect(conversation.id)} disabled={chatBusy}
                    aria-current={activeId === conversation.id ? "page" : undefined} title={conversation.title}
                    className="recent-chat-row flex items-center w-full min-w-0 h-8 rounded-md pl-2 pr-8 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-50">
                    <span className="truncate">{conversation.title}</span>
                  </button>
                  <ConversationActions conversation={conversation} chatBusy={chatBusy} onDeleted={() => refreshRef.current?.focus()} />
                </li>
              ))}
            </ul>}
    </div>
  );
}
