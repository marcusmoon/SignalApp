export function finnhubQuoteHasValidPrice(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false;
  const c = (q as { c?: unknown }).c;
  return typeof c === 'number' && Number.isFinite(c);
}
