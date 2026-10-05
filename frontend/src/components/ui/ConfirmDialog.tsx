import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  tone?: "default" | "session";
  busy?: boolean;
  error?: string | null;
  closeOnConfirm?: boolean;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
  tone = "default",
  busy = false,
  error,
  closeOnConfirm = true,
  returnFocusRef,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const session = tone === "session" && !destructive;
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!busy || nextOpen) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[--overlay] z-50" />
        <Dialog.Content aria-modal="true" onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}
          onCloseAutoFocus={(event) => { if (returnFocusRef) { event.preventDefault(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); } }}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }}
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 outline-none ${session ? 'session-confirmation' : 'bg-panel border border-[--border-strong] rounded-lg p-6 w-[calc(100vw-2rem)] max-w-[420px]'}`}>
          <div className={`flex items-start justify-between gap-3 ${session ? 'mb-3' : 'mb-4'}`}>
            <Dialog.Title className="text-md font-semibold text-[--text-primary]">
              {title}
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close dialog" className="icon-button disabled:opacity-40">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className={`text-sm text-[--text-secondary] leading-relaxed ${session ? 'mb-5' : 'mb-6'}`}>
            {description}
          </Dialog.Description>
          {error && <p role="alert" className="mb-4 text-xs text-error break-words">{error}</p>}
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild><Button ref={cancelRef} variant={session ? 'ghost' : 'outline'} disabled={busy}>Cancel</Button></Dialog.Close>
            <Button
              onClick={() => {
                onConfirm();
                if (closeOnConfirm) onOpenChange(false);
              }}
              disabled={busy}
              variant={destructive ? 'danger' : session ? 'danger-solid' : 'primary'}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
