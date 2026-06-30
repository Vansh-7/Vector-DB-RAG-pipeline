import type { LogEntry as LogEntryType } from '../../types';
import { LOG_LEVEL_COLORS } from '../../types/log';

interface LogEntryProps {
  entry: LogEntryType;
}

export function LogEntry({ entry }: LogEntryProps) {
  const levelColor = LOG_LEVEL_COLORS[entry.level];

  return (
    <div className="flex gap-2 animate-log-slide-in leading-[18px]">
      <span className="text-[#444] shrink-0">[{entry.timestamp}]</span>
      <span className="shrink-0 font-medium" style={{ color: levelColor }}>
        [{entry.level}]
      </span>
      <span className="text-[#888]">{entry.message}</span>
    </div>
  );
}
