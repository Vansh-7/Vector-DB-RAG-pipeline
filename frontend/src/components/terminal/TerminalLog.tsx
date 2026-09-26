import { useEffect, useRef } from "react";
import { X, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";
import { LogEntry } from "./LogEntry";
import { useTerminalStore } from "../../store/terminalStore";
import { useSessionStore } from "../../store/sessionStore";
import { LOG_LEVEL_COLORS } from "../../types/log";

export function TerminalLog() {
  const logs = useTerminalStore((s) => s.logs);
  const status = useTerminalStore((s) => s.status);
  const clear = useTerminalStore((s) => s.clear);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);

  const { isTerminalCollapsed, terminalHeight, setTerminalCollapsed, setTerminalHeight } = useSessionStore();
  const heightRef = useRef(terminalHeight);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { heightRef.current = terminalHeight; }, [terminalHeight]);

  useEffect(() => {
    if (scrollRef.current && !isTerminalCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isTerminalCollapsed]);

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

  // Handle resizing
  useEffect(() => {
    const handle = resizeRef.current;
    if (!handle) return;

    let startY = 0;
    let startHeight = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (isTerminalCollapsed) return;
      e.preventDefault();
      startY = e.clientY;
      startHeight = heightRef.current;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "ns-resize";
    };

    const onMouseMove = (e: MouseEvent) => {
      const deltaY = startY - e.clientY;
      const newHeight = Math.min(Math.max(startHeight + deltaY, 120), 400, window.innerHeight * 0.45);
      setTerminalHeight(newHeight);
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
    };

    handle.addEventListener("mousedown", onMouseDown);
    return () => {
      handle.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
    };
  }, [isTerminalCollapsed, setTerminalHeight]);

  return (
    <div
      role="region" aria-label="Terminal"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isTerminalCollapsed) {
          setTerminalCollapsed(true);
          toggleRef.current?.focus();
        }
      }}
      className={`border-t border-[rgba(255,255,255,0.06)] bg-[#0a0a0a] flex flex-col transition-[height] duration-300 ease-in-out relative shrink-0`}
      style={{ height: isTerminalCollapsed ? '32px' : `min(${terminalHeight}px, 45dvh, 400px)` }}
    >
      {/* Resize Handle */}
      {!isTerminalCollapsed && (
        <div
          ref={resizeRef}
          role="separator" aria-label="Resize terminal" aria-orientation="horizontal"
          aria-valuemin={120} aria-valuemax={400} aria-valuenow={Math.min(400, terminalHeight)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp" || event.key === "ArrowDown") {
              event.preventDefault();
              setTerminalHeight(Math.min(400, Math.max(120, terminalHeight + (event.key === "ArrowUp" ? 20 : -20))));
            }
          }}
          tabIndex={0} className="absolute top-0 left-0 right-0 h-1 -mt-0.5 cursor-ns-resize hover:bg-[rgba(255,255,255,0.1)] focus-visible:bg-[rgba(255,255,255,0.2)] focus-visible:outline-none z-10 transition-colors"
        />
      )}

      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-[rgba(255,255,255,0.06)] select-none h-8 shrink-0 overflow-hidden"
      >
        <button ref={toggleRef} type="button" aria-label={isTerminalCollapsed ? "Expand terminal" : "Collapse terminal"}
          aria-expanded={!isTerminalCollapsed} aria-controls="terminal-output"
          onClick={() => setTerminalCollapsed(!isTerminalCollapsed)}
          className="flex flex-1 min-w-0 items-center gap-3 overflow-hidden text-left rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#888]">
          <span className="text-[#444] hover:text-[#f4f4f4] transition-colors shrink-0">
            {isTerminalCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </span>
          
          <span className="text-2xs font-medium tracking-widest text-[#555] uppercase shrink-0">
            Terminal
          </span>

          {/* Last log preview when collapsed */}
          {isTerminalCollapsed && lastLog && (
            <span className="flex items-center gap-2 overflow-hidden px-2 border-l border-[rgba(255,255,255,0.06)]">
              <span className="text-[#444] shrink-0 font-mono text-xs hidden sm:inline">[{lastLog.timestamp}]</span>
              <span className="shrink-0 font-medium font-mono text-xs hidden sm:inline" style={{ color: LOG_LEVEL_COLORS[lastLog.level] }}>
                [{lastLog.level}]
              </span>
              <span className="text-[#888] font-mono text-xs truncate max-w-[200px] md:max-w-[400px]">
                {lastLog.message}
              </span>
            </span>
          )}

          {/* Status Indicator */}
          <span className="flex items-center gap-2 ml-auto pl-2 shrink-0">
            {status === "connected" ? (
              <span className="flex items-center gap-1 text-2xs text-[#22c55e] font-mono" title="Connected">
                <Wifi className="w-3 h-3" />
                <span>LIVE</span>
              </span>
            ) : status === "connecting" ? (
              <span className="flex items-center gap-1 text-2xs text-[#f59e0b] font-mono animate-pulse" title="Connecting...">
                <Wifi className="w-3 h-3" />
                <span>CONNECTING</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-2xs text-[#ef4444] font-mono" title="Disconnected. Auto-reconnecting...">
                <WifiOff className="w-3 h-3" />
                <span>OFFLINE</span>
              </span>
            )}
          </span>
        </button>
        
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clear();
          }}
          className="text-[#444] hover:text-[#888] transition-colors shrink-0 ml-2"
          title="Clear terminal"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Log Output Container */}
      <div
        id="terminal-output"
        ref={scrollRef}
        className={`flex-1 min-h-0 overflow-y-auto break-words p-3 font-mono text-xs space-y-0.5 ${isTerminalCollapsed ? "hidden" : "block"}`}
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
    </div>
  );
}
