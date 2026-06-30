import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../api/status";
import { useCanvasStore } from "../store/canvasStore";
import { useTerminalStore } from "../store/terminalStore";
import { AlertCircle } from "lucide-react";
import { generateMockVectors } from "../mocks/vectors";

export function DataLoader() {
  const setVectors = useCanvasStore((s) => s.setVectors);
  const setMeta = useCanvasStore((s) => s.setMeta);
  const setStatus = useTerminalStore((s) => s.setStatus);
  const prevCountRef = useRef<number | null>(null);

  const { isError, isSuccess, data: statusData } = useQuery({
    queryKey: ["dbStatus"],
    queryFn: getStatus,
    refetchInterval: 10000, // Poll every 10s
    retry: false,
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

      // Update vector canvas using seeded mock generator based on actual DB count
      // This physically mounts points in the 3D grid as the backend docs grow
      if (statusData.total_docs !== prevCountRef.current) {
         setVectors(generateMockVectors(statusData.total_docs));
         prevCountRef.current = statusData.total_docs;
      }
    } else if (isError) {
      setStatus("offline");
    }
  }, [isSuccess, isError, statusData, setStatus, setMeta, setVectors]);

  if (isError) {
    return (
      <div className="absolute top-0 left-0 right-0 z-[100] bg-[#ef4444] text-white px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium shadow-lg animate-in slide-in-from-top-2">
        <AlertCircle className="w-4 h-4" />
        Backend API is offline. Cannot connect to Vector DB at {import.meta.env.VITE_API_BASE_URL}.
      </div>
    );
  }

  return null;
}
