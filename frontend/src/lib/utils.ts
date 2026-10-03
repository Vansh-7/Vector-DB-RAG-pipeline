export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function getScoreColor(score: number): string {
  if (score >= 0.9) return 'var(--score-high)';
  if (score >= 0.7) return 'var(--score-mid)';
  return 'var(--score-low)';
}

export function getLatencyColor(ms: number): string {
  if (ms < 5) return 'var(--score-high)';
  if (ms <= 20) return 'var(--score-mid)';
  return 'var(--score-low)';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function getCurrentTimestamp(): string {
  const now = new Date();
  return [
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join(':');
}
