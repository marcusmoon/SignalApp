const MAX_RECENT = 240;
const WINDOW_MS = 15 * 60 * 1000;

const recent = [];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * p) - 1));
  return sorted[index];
}

function routeKey(url) {
  try {
    const parsed = new URL(url || '/', 'http://signal.local');
    return parsed.pathname || '/';
  } catch {
    return String(url || '/').split('?')[0] || '/';
  }
}

export function recordHttpRequest({ method, url, statusCode, elapsedMs, level, at = new Date().toISOString() }) {
  recent.unshift({
    at,
    method: String(method || 'GET'),
    path: routeKey(url),
    statusCode: Number(statusCode) || 0,
    elapsedMs: Math.max(0, Number(elapsedMs) || 0),
    level: String(level || 'ok'),
  });
  if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
}

export function httpMetricsSnapshot({ now = Date.now() } = {}) {
  const windowStart = now - WINDOW_MS;
  const windowRows = recent.filter((row) => Date.parse(row.at) >= windowStart);
  const durations = windowRows.map((row) => row.elapsedMs);
  const slowRows = windowRows.filter((row) => row.level === 'slow' || row.level === 'very-slow');
  const errorRows = windowRows.filter((row) => row.statusCode >= 500);
  const topSlow = [...slowRows]
    .sort((a, b) => b.elapsedMs - a.elapsedMs)
    .slice(0, 5);
  return {
    windowMinutes: Math.round(WINDOW_MS / 60000),
    total: windowRows.length,
    slow: slowRows.length,
    verySlow: windowRows.filter((row) => row.level === 'very-slow').length,
    errors: errorRows.length,
    avgMs: durations.length ? Math.round(durations.reduce((sum, n) => sum + n, 0) / durations.length) : 0,
    p95Ms: percentile(durations, 0.95),
    topSlow,
  };
}
