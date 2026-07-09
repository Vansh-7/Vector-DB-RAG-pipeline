import { useState, useRef } from "react";
import { Upload, FileText, Loader2, RotateCcw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestDocument, ingestFile } from "../../api/ingest";
import { useTerminalStore } from "../../store/terminalStore";
import { useSessionStore } from "../../store/sessionStore";
import { getCurrentTimestamp } from "../../lib/utils";
import { Button } from "../ui/Button";

export function IngestPanel() {
  const mode = useSessionStore((s) => s.ingestMode);
  const setMode = useSessionStore((s) => s.setIngestMode);
  const title = useSessionStore((s) => s.ingestTitle);
  const setTitle = useSessionStore((s) => s.setIngestTitle);
  const description = useSessionStore((s) => s.ingestDescription);
  const setDescription = useSessionStore((s) => s.setIngestDescription);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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
        });
      }
    },
    onSuccess: (resData) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: resData.message || "Successfully ingested document.",
      });
      queryClient.invalidateQueries({ queryKey: ["vectorSample"] });
      queryClient.invalidateQueries({ queryKey: ["vectorMeta"] });
      setTitle("");
      setDescription("");
      setDroppedFile(null);
    },
    onError: (err) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "ERROR",
        message: `Ingestion failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setDroppedFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setDroppedFile(file);
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isSubmitDisabled =
    mutation.isPending ||
    (mode === "file" && !droppedFile) ||
    (mode === "manual" && (!title.trim() || !description.trim()));

  return (
    <div className="p-4 space-y-4 flex flex-col h-full">
      <div className="text-xs text-[#888] mb-1">Upload a document to automatically chunk and embed its contents.</div>

      {/* Mode toggle */}
      <div className="flex bg-[#0a0a0a] rounded-[4px] p-0.5 border border-[rgba(255,255,255,0.06)] shrink-0">
        <button
          onClick={() => setMode("file")}
          className={`flex-1 text-xs font-medium py-1.5 rounded-[3px] transition-colors ${
            mode === "file"
              ? "bg-[#222] text-[#f4f4f4]"
              : "text-[#555] hover:text-[#888]"
          }`}
        >
          File Drop
        </button>
        <button
          onClick={() => setMode("manual")}
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
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-md flex-1 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
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
              <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
                Title / Topic
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., System Architecture Guidelines"
                className="w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
              />
            </div>
            <div className="flex-1 flex flex-col min-h-[160px]">
              <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
                Document Content
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste raw text, markdown, or JSON payload here..."
                className="w-full flex-1 bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none resize-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[rgba(255,255,255,0.06)] shrink-0">
        <button
          onClick={handleReset}
          disabled={!droppedFile && !title.trim() && !description.trim()}
          className="flex items-center justify-center w-10 h-10 bg-[#161616] hover:bg-[#1a1a1a] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)] text-[#555] hover:text-[#ef4444] rounded-[4px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Clear Inputs"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <Button
          onClick={() => mutation.mutate()}
          disabled={isSubmitDisabled}
          className="flex-1 py-2 h-10"
        >
          {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
          Ingest Document
        </Button>
      </div>
    </div>
  );
}
