import { ContextPane } from "../layout/ContextPane";
import { IngestPanel } from "../panels/IngestPanel";
import type { IngestResponse } from "../../types/ingest";
import { useSessionStore } from "../../store/sessionStore";

export function AddDocumentPane({ open, onClose, onSuccess, processing, onProcessingChange }: {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: IngestResponse) => void;
  processing: boolean;
  onProcessingChange: (processing: boolean) => void;
}) {
  const mode = useSessionStore((s) => s.ingestMode);
  return <ContextPane open={open} title="Add document" description="Upload a file or paste text to add it to your knowledge."
    onClose={onClose} busy={processing} initialFocus={mode === "manual" ? "#document-title" : '[aria-label="Choose a document file"]'}>
    <IngestPanel onSuccess={onSuccess} onProcessingChange={onProcessingChange} />
  </ContextPane>;
}
