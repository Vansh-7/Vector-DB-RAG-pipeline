import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../api/status";
import { getVectorSample } from "../api/vectors";
import { useCanvasStore } from "../store/canvasStore";
import { useTerminalStore } from "../store/terminalStore";
import { AlertCircle } from "lucide-react";

export function DataLoader() {
  const setVectors = useCanvasStore((s) => s.setVectors);
  const setMeta = useCanvasStore((s) => s.setMeta);
  const setStatus = useTerminalStore((s) => s.setStatus);

  const { isError, isSuccess, data: statusData } = useQuery({
    queryKey: ["dbStatus"],
    queryFn: getStatus,
    refetchInterval: 10000, // Poll every 10s
    retry: false,
  });

  const { data: sampleData } = useQuery({
    queryKey: ["vectorSample", statusData?.total_docs],
    queryFn: () => getVectorSample(2000),
    enabled: isSuccess && !!statusData,
  });

  useEffect(() => {
    if (isSuccess && statusData) {
      setStatus("connected");
      setMeta({
        dimensions: 768,
        totalVectors: statusData.total_docs,
        indexAlgorithm: statusData.engine as any,
        lastUpdated: new Date().toISOString(),
      });
    } else if (isError) {
      setStatus("offline");
    }
  }, [isSuccess, isError, statusData, setStatus, setMeta]);

  useEffect(() => {
    if (sampleData) {
      setVectors(sampleData.vectors);
    }
  }, [sampleData, setVectors]);

  if (isError) {
    return (
      <div role="status" className="shrink-0 bg-[#ef4444]/10 text-[#ef4444] border-b border-[#ef4444]/20 px-4 py-2 flex items-center gap-2 text-xs">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span className="min-w-0 break-words">Backend API is unavailable. Check the connection to {import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}.</span>
      </div>
    );
  }

  return null;
}
