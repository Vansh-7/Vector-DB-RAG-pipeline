import { useState } from "react";
import { Upload, FileText, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ingestDocument, ingestFile } from "../../api/ingest";
import { useEngineStore } from "../../store/engineStore";
import { useTerminalStore } from "../../store/terminalStore";
import { getCurrentTimestamp } from "../../lib/utils";


type IngestMode = "file" | "manual";

export function IngestPanel() {
  const [mode, setMode] = useState<IngestMode>("manual");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const category = useEngineStore((s) => s.category);
  const addLog = useTerminalStore((s) => s.addLog);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "file" && droppedFile) {
        return ingestFile(droppedFile, category);
      } else {
        return ingestDocument({
          title,
          content: description,
          category,
        });
      }
    },
    onSuccess: (resData) => {
      addLog({
        timestamp: getCurrentTimestamp(),
        level: "INFO",
        message: `Successfully ingested ${resData.chunksAdded} chunks.`,
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const isSubmitDisabled =
    mutation.isPending ||
    (mode === "file" && !droppedFile) ||
    (mode === "manual" && (!title.trim() || !description.trim()));

  return (
    <div className="p-4 space-y-4">
      {/* Mode toggle */}
      <div className="flex bg-[#0a0a0a] rounded-[4px] p-0.5 border border-[rgba(255,255,255,0.06)]">
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

      {mode === "file" ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-md p-8 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
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
              <span className="text-sm text-[#f4f4f4]">{droppedFile.name}</span>
              <span className="text-2xs text-[#555] ml-auto">
                {formatFileSize(droppedFile.size)}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Title / Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Financial Report Summary"
              className="w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
            />
          </div>
          <div>
            <label className="text-2xs font-medium tracking-widest text-[#555] uppercase block mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter the document content to be chunked and embedded..."
              rows={6}
              className="w-full bg-[#161616] border border-[rgba(255,255,255,0.1)] rounded-[4px] px-3 py-2 text-sm text-[#f4f4f4] placeholder:text-[#555] outline-none resize-none focus:border-[rgba(255,255,255,0.18)] transition-colors"
            />
          </div>
        </div>
      )}

      <button
        onClick={() => mutation.mutate()}
        disabled={isSubmitDisabled}
        className="w-full bg-white text-black text-sm font-medium rounded-[4px] py-2 hover:bg-[#e5e5e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        Insert Document
      </button>
    </div>
  );
}
