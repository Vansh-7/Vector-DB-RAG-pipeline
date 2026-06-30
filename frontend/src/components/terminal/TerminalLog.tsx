import { useEffect, useRef, useState } from "react";
import { X, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";
import { LogEntry } from "./LogEntry";
import { useTerminalStore } from "../../store/terminalStore";

export function TerminalLog() {
  const logs = useTerminalStore((s) => s.logs);
  const status = useTerminalStore((s) => s.status);
  const clear = useTerminalStore((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isExpanded]);

  return (
    <div
      className={`border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a] flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? "h-[220px]" : "h-8"
      }`}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-[rgba(255,255,255,0.06)] cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button type="button" className="text-[#444] hover:text-[#f4f4f4] transition-colors focus:outline-none">
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
          <span className="text-2xs font-medium tracking-widest text-[#555] uppercase">
            Terminal
          </span>
          {status === "connected" ? (
            <div className="flex items-center gap-1 text-2xs text-[#22c55e] font-mono" title="Connected">
              <Wifi className="w-3 h-3" />
              <span>LIVE</span>
            </div>
          ) : status === "connecting" ? (
            <div className="flex items-center gap-1 text-2xs text-[#f59e0b] font-mono animate-pulse" title="Connecting...">
              <Wifi className="w-3 h-3" />
              <span>CONNECTING</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-2xs text-[#ef4444] font-mono" title="Disconnected. Auto-reconnecting...">
              <WifiOff className="w-3 h-3" />
              <span>OFFLINE</span>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clear();
          }}
          className="text-[#444] hover:text-[#888] transition-colors"
          title="Clear terminal"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {isExpanded && (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5"
        >
          {logs.map((entry, i) => (
            <LogEntry key={i} entry={entry} />
          ))}
          {logs.length === 0 && (
            <div className="text-[#555] text-xs font-mono italic">
              Waiting for logs...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
