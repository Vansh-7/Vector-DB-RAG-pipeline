import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, MessageSquare, MoreHorizontal, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationKeys, deleteConversation, renameConversation } from "../../api/conversations";
import { useConversations } from "../../hooks/useConversations";
import { useAuthStore } from "../../store/authStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import type { ConversationRecord } from "../../types/conversation";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function RecentConversations({ chatBusy, onSelect }: { chatBusy: boolean; onSelect: (id: number) => void }) {
  const userId = useAuthStore((s) => s.user?.id);
  const activeId = useSessionStore((s) => s.activeConversationId);
  const setActiveId = useSessionStore((s) => s.setActiveConversationId);
  const query = useConversations();
  const queryClient = useQueryClient();
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renaming, setRenaming] = useState<ConversationRecord | null>(null);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<ConversationRecord | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const menuRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (menuId === null) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const close = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenuId(null); };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const trigger = menuRef.current?.querySelector<HTMLButtonElement>('[aria-haspopup="menu"]');
        setMenuId(null);
        trigger?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [menuId]);

  const renameMutation = useMutation({
    mutationFn: ({ id, nextTitle }: { id: number; nextTitle: string }) => renameConversation(id, nextTitle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
      setRenaming(null);
      setActionError(null);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not rename chat."),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteConversation,
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
      queryClient.removeQueries({ queryKey: conversationKeys.messages(userId, id) });
      if (activeId === id) {
        setActiveId(null);
        useCanvasStore.getState().setHighlighted([]);
        useCanvasStore.getState().setQueryPoint(null);
      }
      setDeleting(null);
      setActionError(null);
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not delete chat."),
  });

  return (
    <div className="mx-3 mt-5 border-t border-[--border-subtle] pt-4 min-w-0">
      <div className="flex items-center justify-between px-2 mb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[--text-tertiary]">Recent chats</h2>
        <button type="button" onClick={() => void query.refetch()} title="Refresh chats" aria-label="Refresh chats" className="rounded p-1 text-[--text-tertiary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      {actionError && <p role="alert" className="px-2 py-2 text-xs text-error break-words">{actionError}</p>}
      {query.isPending ? <div aria-label="Loading recent chats" className="px-2 py-3 text-xs text-[--text-secondary] flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading chats</div>
        : query.isError ? <div className="px-2 py-2 text-xs text-error">Could not load chats. <button type="button" onClick={() => void query.refetch()} className="underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-error">Retry</button></div>
          : query.data.length === 0 ? <p className="px-2 py-2 text-xs leading-relaxed text-[--text-secondary]">Your conversations will appear here after your first question.</p>
            : <ul className="space-y-0.5">
              {query.data.map((conversation) => (
                <li key={conversation.id} className="relative group min-w-0" ref={menuId === conversation.id ? menuRef : undefined}>
                  <button type="button" onClick={() => onSelect(conversation.id)} disabled={chatBusy}
                    aria-current={activeId === conversation.id ? "page" : undefined} title={conversation.title}
                    className={`flex items-center gap-2 w-full min-w-0 rounded-[4px] py-2 pl-2 pr-8 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-50 ${activeId === conversation.id ? "bg-active text-[--text-primary]" : "text-[--text-secondary] hover:bg-hover hover:text-[--text-primary]"}`}>
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden="true" /><span className="truncate">{conversation.title}</span>
                  </button>
                  <button type="button" onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} disabled={chatBusy}
                    aria-label={`Options for ${conversation.title}`} aria-expanded={menuId === conversation.id} aria-haspopup="menu"
                    className="absolute right-1 top-1 rounded p-1.5 text-[--text-secondary] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 hover:bg-elevated hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-40">
                    <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  {menuId === conversation.id && <div role="menu" aria-label={`Options for ${conversation.title}`} onKeyDown={(event) => {
                    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                    event.preventDefault();
                    const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
                    const index = items.indexOf(document.activeElement as HTMLButtonElement);
                    items[(index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
                  }} className="absolute z-30 right-0 top-9 w-36 rounded-[4px] border border-[--border-default] bg-elevated p-1 shadow-xl">
                    <button type="button" role="menuitem" onClick={() => { setRenaming(conversation); setTitle(conversation.title); setActionError(null); setMenuId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-hover focus-visible:outline-none focus-visible:bg-hover"><Pencil className="w-3.5 h-3.5" /> Rename</button>
                    <button type="button" role="menuitem" onClick={() => { deleteMutation.reset(); setDeleting(conversation); setActionError(null); setMenuId(null); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-error hover:bg-error/10 focus-visible:outline-none focus-visible:bg-error/10"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                  </div>}
                </li>
              ))}
            </ul>}

      <Dialog.Root open={renaming !== null} onOpenChange={(open) => { if (!open && !renameMutation.isPending) setRenaming(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[--border-default] bg-panel p-5 shadow-2xl outline-none">
            <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-sm font-semibold">Rename chat</Dialog.Title><Dialog.Close disabled={renameMutation.isPending} aria-label="Close rename dialog" className="rounded p-1 text-[--text-secondary] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]"><X className="w-4 h-4" /></Dialog.Close></div>
            <Dialog.Description className="mt-2 text-xs text-[--text-secondary]">Choose a name that helps you find this conversation later.</Dialog.Description>
            <form onSubmit={(event) => { event.preventDefault(); if (renaming && title.trim() && !renameMutation.isPending) renameMutation.mutate({ id: renaming.id, nextTitle: title.trim() }); }}>
              <label htmlFor="conversation-title" className="mt-5 mb-1.5 block text-xs text-[--text-secondary]">Conversation name</label>
              <input id="conversation-title" autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} disabled={renameMutation.isPending} className="w-full rounded-[4px] border border-[--border-default] bg-elevated px-3 py-2 text-sm outline-none focus:border-[--color-info]" />
              {renameMutation.isError && <p role="alert" className="mt-2 text-xs text-error">{actionError}</p>}
              <div className="mt-5 flex justify-end gap-2"><Dialog.Close type="button" disabled={renameMutation.isPending} className="rounded-[4px] border border-[--border-default] px-3 py-2 text-xs text-[--text-secondary] hover:bg-hover">Cancel</Dialog.Close><button type="submit" disabled={!title.trim() || renameMutation.isPending} className="rounded-[4px] bg-white px-3 py-2 text-xs font-medium text-black disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">{renameMutation.isPending ? "Saving…" : "Save name"}</button></div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <ConfirmDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="Delete chat?" description={`Delete “${deleting?.title ?? "this chat"}” and its saved messages? This cannot be undone.`} confirmLabel="Delete chat" destructive busy={deleteMutation.isPending} error={deleteMutation.isError ? actionError : null} closeOnConfirm={false} onConfirm={() => { if (deleting && !deleteMutation.isPending) deleteMutation.mutate(deleting.id); }} />
    </div>
  );
}
