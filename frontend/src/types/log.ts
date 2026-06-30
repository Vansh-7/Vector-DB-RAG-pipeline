export type LogLevel = 'INFO' | 'SUCCESS' | 'ERROR' | 'WARNING';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

export const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  INFO: '#3b82f6',
  SUCCESS: '#22c55e',
  ERROR: '#ef4444',
  WARNING: '#f59e0b',
};
