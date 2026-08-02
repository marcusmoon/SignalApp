/** 시세 탭 상단 세그먼트 키·기본 순서 (순수 — Node 테스트 가능) */
export const QUOTES_SEGMENT_KEYS = ['watch', 'etf', 'coin'] as const;
export type QuoteSegmentKey = (typeof QUOTES_SEGMENT_KEYS)[number];

export const DEFAULT_QUOTES_SEGMENT_ORDER: QuoteSegmentKey[] = [...QUOTES_SEGMENT_KEYS];

/** 구 인기·시총 세그먼트 → ETF */
export function migrateLegacyQuotesSegmentKey(raw: unknown): QuoteSegmentKey | null {
  const key = String(raw || '').trim();
  if (key === 'popular' || key === 'mcap') return 'etf';
  if ((QUOTES_SEGMENT_KEYS as readonly string[]).includes(key)) return key as QuoteSegmentKey;
  return null;
}

export function normalizeQuotesSegmentOrder(raw: unknown): QuoteSegmentKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_QUOTES_SEGMENT_ORDER];
  const out: QuoteSegmentKey[] = [];
  const seen = new Set<QuoteSegmentKey>();
  for (const x of raw) {
    const key = migrateLegacyQuotesSegmentKey(x);
    if (!key || seen.has(key)) continue;
    out.push(key);
    seen.add(key);
  }
  for (const k of QUOTES_SEGMENT_KEYS) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
