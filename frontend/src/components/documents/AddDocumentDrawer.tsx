import type { RefObject } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IngestPanel } from "../panels/IngestPanel";
import type { IngestResponse } from "../../types/ingest";
import { useSessionStore } from "../../store/sessionStore";

interface AddDocumentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (result: IngestResponse) => void;
  processing: boolean;
  onProcessingChange: (processing: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}

export function AddDocumentDrawer({ open, onOpenChange, onSuccess, processing, onProcessingChange, returnFocusRef }: AddDocumentDrawerProps) {
  const mode = useSessionStore((s) => s.ingestMode);
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (!processing || nextOpen) onOpenChange(nextOpen); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            const target = mode === "manual" ? document.getElementById("document-title") : document.querySelector<HTMLElement>('[aria-label="Choose a document file"]');
            target?.focus();
          }}
          onEscapeKeyDown={(event) => { if (processing) event.preventDefault(); }}
          onPointerDownOutside={(event) => { if (processing) event.preventDefault(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[520px] min-w-0 flex-col border-l border-[--border-default] bg-panel shadow-[-24px_0_80px_rgba(0,0,0,0.55)] outline-none"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[--border-subtle] px-5 py-5 shrink-0">
            <div>
              <Dialog.Title className="text-base font-semibold text-[--text-primary]">Add document</Dialog.Title>
              <Dialog.Description className="text-xs text-[--text-secondary] mt-1">Upload a file or paste text into your knowledge space.</Dialog.Description>
            </div>
            <Dialog.Close disabled={processing} aria-label="Close add document"
              className="rounded p-1.5 text-[--text-secondary] hover:bg-hover hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--color-info]">
              <X className="w-4 h-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <IngestPanel onSuccess={onSuccess} onProcessingChange={onProcessingChange} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
