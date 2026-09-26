import { useEffect, useState, useRef } from "react";
import { Upload, FileText, Loader2, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestDocument, ingestFile } from "../../api/ingest";
import { useTerminalStore } from "../../store/terminalStore";
import { useSessionStore } from "../../store/sessionStore";
import { getCurrentTimestamp } from "../../lib/utils";
import { Button } from "../ui/Button";
import type { IngestResponse } from "../../types/ingest";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".txt", ".md"];

export function IngestPanel({ onSuccess, onProcessingChange }: {
  onSuccess?: (result: IngestResponse) => void;
  onProcessingChange?: (processing: boolean) => void;
}) {
  const mode = useSessionStore((s) => s.ingestMode);
  const setMode = useSessionStore((s) => s.setIngestMode);
  const title = useSessionStore((s) => s.ingestTitle);
  const setTitle = useSessionStore((s) => s.setIngestTitle);
  const description = useSessionStore((s) => s.ingestDescription);
  const setDescription = useSessionStore((s) => s.setIngestDescription);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  // Independent local state for the ingest category
  const addLog = useTerminalStore((s) => s.addLog);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "file" && droppedFile) {
        return ingestFile(droppedFile, "DOCUMENTS");
      } else {
        return ingestDocument({
          text: title ? `${title}\n\n${description}` : description,
          category: "DOCUMENTS",
          title: title.trim() || undefined,
        });
      }
    },
    onSuccess: (resData) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: resData.message || "Successfully ingested document.",
      });
      for (const key of ["documents", "dbStatus", "vectorSample", "vectorMeta", "search", "benchmarks"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
      setTitle("");
      setDescription("");
      setDroppedFile(null);
      setFileError(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSuccess?.(resData);
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "ERROR",
        message: `Ingestion failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    },
    onSettled: () => { submittingRef.current = false; },
  });

  useEffect(() => {
    onProcessingChange?.(mutation.isPending);
  }, [mutation.isPending, onProcessingChange]);

  const selectFile = (file: File) => {
    const filename = file.name.toLowerCase();
    if (!ALLOWED_EXTENSIONS.some((extension) => filename.endsWith(extension))) {
      setDroppedFile(null);
      setFileError("Choose a PDF, TXT, or Markdown file.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else if (file.size > MAX_FILE_BYTES) {
      setDroppedFile(null);
      setFileError("File must be 10 MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else if (file.size === 0) {
      setDroppedFile(null);
      setFileError("Choose a file that is not empty.");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      setDroppedFile(file);
      setFileError(null);
    }
    mutation.reset();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !mutation.isPending) selectFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !mutation.isPending) selectFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const handleReset = () => {
    setTitle("");
    setDescription("");
    setDroppedFile(null);
    setFileError(null);
    mutation.reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isSubmitDisabled =
    mutation.isPending ||
    (mode === "file" && !droppedFile) ||
    (mode === "manual" && !description.trim());

  return (
    <div className="p-4 space-y-4 flex flex-col h-full">
      <div className="text-xs text-[#888] mb-1">Upload a document to automatically chunk and embed its contents.</div>

      {/* Mode toggle */}
      <div className="flex bg-[#0a0a0a] rounded-[4px] p-0.5 border border-[rgba(255,255,255,0.06)] shrink-0">
        <button
          type="button"
          onClick={() => { setMode("file"); mutation.reset(); }}
          disabled={mutation.isPending}
          aria-pressed={mode === "file"}
          className={`flex-1 text-xs font-medium py-1.5 rounded-[3px] transition-colors ${
            mode === "file"
              ? "bg-[#222] text-[#f4f4f4]"
              : "text-[#555] hover:text-[#888]"
          }`}
        >
          File Drop
        </button>
        <button
          type="button"
          onClick={() => { setMode("manual"); mutation.reset(); }}
          disabled={mutation.isPending}
          aria-pressed={mode === "manual"}
          className={`flex-1 text-xs font-medium py-1.5 rounded-[3px] transition-colors ${
            mode === "manual"
              ? "bg-[#222] text-[#f4f4f4]"
              : "text-[#555] hover:text-[#888]"
          }`}
        >
          Manual Entry
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {mode === "file" ? (
          <div className="space-y-3 h-full flex flex-col">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept=".txt,.pdf,.md"
              title="Upload file"
              aria-label="Upload document file"
            />
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => { if (!mutation.isPending) fileInputRef.current?.click(); }}
              onKeyDown={(e) => { if (!mutation.isPending && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); fileInputRef.current?.click(); } }}
              role="button" tabIndex={mutation.isPending ? -1 : 0} aria-label="Choose a document file" aria-disabled={mutation.isPending}
              className={`border-2 border-dashed rounded-md flex-1 min-h-[180px] flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer focus-visible:outline-none focus-visible:border-[--color-info] ${
                isDragOver
                  ? "border-[#22c55e] bg-[#22c55e]/5"
                  : "border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.2)]"
              }`}
            >
              <Upload className="w-8 h-8 text-[#555]" />
              <div className="text-center">
                <p className="text-sm text-[#888]">Drop file here or click to browse</p>
                <p className="text-2xs text-[#555] mt-1">.txt, .pdf, .md — max 10MB</p>
              </div>
            </div>

            {fileError && <p role="alert" className="text-xs text-error">{fileError}</p>}

            {droppedFile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-[#161616] rounded-[4px] border border-[rgba(255,255,255,0.06)]">
                <FileText className="w-4 h-4 text-[#888]" />
                <span className="text-sm text-[#f4f4f4] truncate">{droppedFile.name}</span>
                <span className="text-2xs text-[#555] ml-auto shrink-0">
                  {formatFileSize(droppedFile.size)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3 h-full flex flex-col">
            <div className="shrink-0">
              <label htmlFor="document-title" className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
                Title / Topic (optional)
              </label>
              <input
                id="document-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={mutation.isPending}
                placeholder="e.g., System Architecture Guidelines"
                className="w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
              />
            </div>
            <div className="flex-1 flex flex-col min-h-[160px]">
              <label htmlFor="document-content" className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
                Document Content
              </label>
              <textarea
                id="document-content"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={mutation.isPending}
                placeholder="Paste raw text, markdown, or JSON payload here..."
                className="w-full flex-1 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none resize-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {mutation.isError && <p role="alert" className="text-xs text-error break-words">{mutation.error instanceof Error ? mutation.error.message : "Document could not be added."}</p>}

      <div className="flex items-center gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <button
          type="button"
          onClick={handleReset}
          disabled={mutation.isPending || (!droppedFile && !title.trim() && !description.trim())}
          className="flex items-center justify-center w-10 h-10 bg-[#161616] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] text-[#555] hover:text-[#ef4444] rounded-[4px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Clear Inputs"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <Button
          type="button"
          onClick={() => {
            if (isSubmitDisabled || submittingRef.current) return;
            submittingRef.current = true;
            onProcessingChange?.(true);
            mutation.mutate();
          }}
          disabled={isSubmitDisabled}
          className="flex-1 py-2 h-10"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          {mutation.isPending ? "Processing document…" : "Index document"}
        </Button>
      </div>
    </div>
  );
}
