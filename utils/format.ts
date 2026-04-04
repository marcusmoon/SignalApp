/** ISO8601 duration e.g. PT1H2M3S → 1:02:03 or mm:ss */
export function formatIso8601Duration(iso: string): string {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '--:--';
  const h = parseInt(m[1] ?? '0', 10);
  const min = parseInt(m[2] ?? '0', 10);
  const s = parseInt(m[3] ?? '0', 10);
  if (h > 0) {
    return `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${min}:${String(s).padStart(2, '0')}`;
}

export function formatViewCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}만회`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1)}만회`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}천회`;
  return `${n}회`;
}
