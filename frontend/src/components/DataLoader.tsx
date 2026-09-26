import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStatus } from "../api/status";
import { useTerminalStore } from "../store/terminalStore";
import { AlertCircle } from "lucide-react";

export function DataLoader() {
  const setStatus = useTerminalStore((s) => s.setStatus);

  const { isError, isSuccess } = useQuery({
    queryKey: ["dbStatus"],
    queryFn: getStatus,
    refetchInterval: 10000, // Poll every 10s
    retry: false,
  });

  useEffect(() => {
    if (isSuccess) {
      setStatus("connected");
    } else if (isError) {
      setStatus("offline");
    }
  }, [isSuccess, isError, setStatus]);

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
