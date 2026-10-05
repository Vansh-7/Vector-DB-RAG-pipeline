import { useEffect, useId, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { conversationKeys, deleteConversation, renameConversation } from "../../api/conversations";
import { useAuthStore } from "../../store/authStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useSessionStore } from "../../store/sessionStore";
import type { ConversationRecord } from "../../types/conversation";
import { ConfirmDialog } from "../ui/ConfirmDialog";

export function ConversationActions({ conversation, chatBusy, label, className = "absolute right-1 top-[3px]", triggerClassName, onDeleted }: {
  conversation: ConversationRecord;
  chatBusy: boolean;
  label?: string;
  className?: string;
  triggerClassName?: string;
  onDeleted?: () => void;
}) {
  const userId = useAuthStore((s) => s.user?.id);
  const activeId = useSessionStore((s) => s.activeConversationId);
  const setActiveId = useSessionStore((s) => s.setActiveConversationId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const close = (event: PointerEvent) => { if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const renameMutation = useMutation({
    mutationFn: ({ id, nextTitle }: { id: number; nextTitle: string }) => renameConversation(id, nextTitle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: conversationKeys.list(userId) });
      setRenaming(false);
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
      setDeleting(false);
      setActionError(null);
      requestAnimationFrame(() => onDeleted?.());
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Could not delete chat."),
  });
  const busy = chatBusy || renameMutation.isPending || deleteMutation.isPending;

  return <div ref={wrapperRef} className={className}>
    <button ref={triggerRef} type="button" onClick={() => setOpen(!open)} disabled={busy}
      aria-label={label ?? `Options for ${conversation.title}`} aria-expanded={open} aria-haspopup="menu"
      className={triggerClassName ?? "flex h-[26px] w-[26px] items-center justify-center rounded-md text-[--text-secondary] opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100 hover:bg-elevated hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info] disabled:opacity-40"}>
      <MoreHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
    </button>
    {open && <div ref={menuRef} role="menu" aria-label={`Options for ${conversation.title}`} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false);
    }} onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus();
      } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    }} className="absolute z-30 right-0 top-[calc(100%+4px)] w-36 rounded-md border border-[--border-default] bg-elevated p-1">
      <button type="button" role="menuitem" disabled={busy} onClick={() => { renameMutation.reset(); setRenaming(true); setTitle(conversation.title); setActionError(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs hover:bg-hover focus-visible:outline-none focus-visible:bg-hover disabled:opacity-40"><Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Rename</button>
      <button type="button" role="menuitem" disabled={busy} onClick={() => { deleteMutation.reset(); setDeleting(true); setActionError(null); setOpen(false); }} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left text-xs text-error hover:bg-error/10 focus-visible:outline-none focus-visible:bg-error/10 disabled:opacity-40"><Trash2 className="w-3.5 h-3.5" aria-hidden="true" /> Delete</button>
    </div>}

    <Dialog.Root open={renaming} onOpenChange={(nextOpen) => { if (!nextOpen && !renameMutation.isPending) setRenaming(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[--overlay]" />
        <Dialog.Content onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus(); }}
          onEscapeKeyDown={(event) => { if (renameMutation.isPending) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (renameMutation.isPending) event.preventDefault(); }}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-md border border-[--border-default] bg-panel p-5 outline-none">
          <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-sm font-semibold">Rename chat</Dialog.Title><Dialog.Close disabled={renameMutation.isPending} aria-label="Close rename dialog" className="icon-button"><X className="w-4 h-4" aria-hidden="true" /></Dialog.Close></div>
          <Dialog.Description className="mt-2 text-xs text-[--text-secondary]">Choose a name that helps you find this conversation later.</Dialog.Description>
          <form onSubmit={(event) => { event.preventDefault(); if (title.trim() && !busy) renameMutation.mutate({ id: conversation.id, nextTitle: title.trim() }); }}>
            <label htmlFor={titleId} className="mt-5 mb-1.5 block text-xs text-[--text-secondary]">Conversation name</label>
            <input id={titleId} autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={255} disabled={renameMutation.isPending} className="field h-10 px-3 text-sm" />
            {renameMutation.isError && <p role="alert" className="mt-2 text-xs text-error">{actionError}</p>}
            <div className="mt-5 flex justify-end gap-2"><Dialog.Close type="button" disabled={renameMutation.isPending} className="rounded-md border border-[--border-default] px-3 py-2 text-xs text-[--text-secondary] hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">Cancel</Dialog.Close><button type="submit" disabled={!title.trim() || busy} className="rounded-md bg-[--primary-action] px-3 py-2 text-sm font-medium text-[--text-inverse] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-info]">{renameMutation.isPending ? "Saving…" : "Save name"}</button></div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <ConfirmDialog open={deleting} onOpenChange={setDeleting} title="Delete chat?" description={`Delete “${conversation.title}” and its saved messages? This cannot be undone.`}
      confirmLabel="Delete chat" destructive busy={deleteMutation.isPending} error={deleteMutation.isError ? actionError : null} closeOnConfirm={false}
      returnFocusRef={triggerRef} onConfirm={() => { if (!busy) deleteMutation.mutate(conversation.id); }} />
  </div>;
}
