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
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  destructive,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-md p-6 w-[420px] z-50 outline-none">
          <div className="flex items-start justify-between mb-4">
            <Dialog.Title className="text-md font-semibold text-[#f4f4f4]">
              {title}
            </Dialog.Title>
            <Dialog.Close className="text-[#555] hover:text-[#888] transition-colors">
              <X className="w-4 h-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="text-sm text-[#888] mb-6 leading-relaxed">
            {description}
          </Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close className="px-4 py-1.5 text-xs text-[#888] border border-[rgba(255,255,255,0.1)] rounded-[4px] hover:bg-[rgba(255,255,255,0.05)] transition-colors">
              Cancel
            </Dialog.Close>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className={`px-4 py-1.5 text-xs font-medium rounded-[4px] transition-colors ${
                destructive
                  ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
                  : 'bg-white text-black hover:bg-[#e5e5e5]'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
