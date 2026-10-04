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
  busy = false,
  error,
  closeOnConfirm = true,
  returnFocusRef,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!busy || nextOpen) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[--overlay] z-50" />
        <Dialog.Content onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}
          onCloseAutoFocus={(event) => { if (returnFocusRef) { event.preventDefault(); if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus(); } }}
          onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-panel border border-[--border-strong] rounded-lg p-6 w-[calc(100vw-2rem)] max-w-[420px] z-50 outline-none">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-md font-semibold text-[--text-primary]">
              {title}
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close dialog" className="icon-button disabled:opacity-40">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-[--text-secondary] mb-6 leading-relaxed">
            {description}
          </Dialog.Description>
          {error && <p role="alert" className="mb-4 text-xs text-error break-words">{error}</p>}
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild><Button ref={cancelRef} variant="outline" disabled={busy}>Cancel</Button></Dialog.Close>
            <Button
              onClick={() => {
                onConfirm();
                if (closeOnConfirm) onOpenChange(false);
              }}
              disabled={busy}
              variant={destructive ? 'danger' : 'primary'}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
