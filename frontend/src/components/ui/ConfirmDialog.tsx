import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

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
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!busy || nextOpen) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onPointerDownOutside={(event) => { if (busy) event.preventDefault(); }} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-md p-6 w-[calc(100vw-2rem)] max-w-[420px] z-50 outline-none">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-md font-semibold text-[#f4f4f4]">
              {title}
            </Dialog.Title>
            <Dialog.Close disabled={busy} aria-label="Close dialog" className="text-[#555] hover:text-[#888] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888] disabled:opacity-40">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-[#888] mb-6 leading-relaxed">
            {description}
          </Dialog.Description>
          {error && <p role="alert" className="mb-4 text-xs text-error break-words">{error}</p>}
          <div className="flex justify-end gap-3">
            <Dialog.Close disabled={busy} className="px-4 py-1.5 text-xs text-[#888] border border-[rgba(255,255,255,0.1)] rounded-[4px] hover:bg-[rgba(255,255,255,0.05)] transition-colors disabled:opacity-40">
              Cancel
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                if (closeOnConfirm) onOpenChange(false);
              }}
              disabled={busy}
              className={`px-4 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                destructive
                  ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
                  : 'bg-white text-black hover:bg-[#e5e5e5]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {busy ? "Working…" : confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
