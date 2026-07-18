/** Shared change-heatmap color math (market briefing sectors · ETF insight). */

export function formatHeatChangePct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 9)) return hex;
  const base = hex.slice(0, 7);
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${base}${a}`;
}

/** |pct| 기준 배경 강도 — ±3%에서 포화 */
export function heatFillColor(
  pct: number | null,
  up: string,
  down: string,
  neutral: string,
): string {
  if (pct == null || !Number.isFinite(pct) || pct === 0) return neutral;
  const intensity = Math.min(1, Math.abs(pct) / 3);
  const alpha = 0.14 + intensity * 0.5;
  return hexWithAlpha(pct > 0 ? up : down, alpha);
}

/** trend 문자열 → 약한 등락 추정 (수치 없을 때 히트맵 채색용) */
export function trendToSoftChangePercent(trend: string | null | undefined): number | null {
  const t = String(trend || '').trim().toLowerCase();
  if (!t) return null;
  if (t === '▲' || t === 'up' || t === '강세' || t === '상승' || t === '상승세' || t === 'bullish') {
    return 0.8;
  }
  if (
    t === '▽' ||
    t === '▼' ||
    t === 'down' ||
    t === '약세' ||
    t === '하락' ||
    t === '하락세' ||
    t === 'bearish'
  ) {
    return -0.8;
  }
  return null;
}
