import {
  DEFAULT_QUOTES_SEGMENT_ORDER,
  QUOTES_SEGMENT_KEYS,
  type QuoteSegmentKey,
} from './constants';

export { DEFAULT_QUOTES_SEGMENT_ORDER, QUOTES_SEGMENT_KEYS, type QuoteSegmentKey };

export function normalizeQuotesSegmentOrder(raw: unknown): QuoteSegmentKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QUOTES_SEGMENT_ORDER];
  const out: QuoteSegmentKey[] = [];
  const seen = new Set<QuoteSegmentKey>();
  for (const x of raw) {
    if (QUOTES_SEGMENT_KEYS.includes(x as QuoteSegmentKey) && !seen.has(x as QuoteSegmentKey)) {
      out.push(x as QuoteSegmentKey);
      seen.add(x as QuoteSegmentKey);
    }
  }
  for (const k of QUOTES_SEGMENT_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
