import type { NewsSegmentKey } from '@/constants/newsSegment';
import { NEWS_SEGMENT_ORDER } from '@/constants/newsSegment';

const ALL_KEYS: NewsSegmentKey[] = [...NEWS_SEGMENT_ORDER];

function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function normalizeNewsSegmentOrder(raw: unknown): NewsSegmentKey[] {
  if (!Array.isArray(raw)) return [...NEWS_SEGMENT_ORDER];
  /** 과거 기본 순서(Watch 포함 등). 필터 전에 raw와 비교해 신규 기본값으로 리셋한다. */
  const previousDefaults: readonly (readonly string[])[] = [
    ['watch', 'global', 'crypto'],
    ['global', 'crypto', 'watch'],
    ['global', 'crypto', 'video', 'watch'],
    ['global', 'korea', 'crypto', 'video', 'watch'],
    ['global', 'korea', 'crypto', 'watch', 'video'],
    ['global', 'korea', 'crypto', 'it', 'video'],
  ];
  const rawKeys = raw.map((x) => String(x));
  if (previousDefaults.some((order) => isSameOrder(rawKeys, order))) {
    return [...NEWS_SEGMENT_ORDER];
  }
  const out: NewsSegmentKey[] = [];
  const seen = new Set<NewsSegmentKey>();
  for (const x of raw) {
    if (ALL_KEYS.includes(x as NewsSegmentKey) && !seen.has(x as NewsSegmentKey)) {
      out.push(x as NewsSegmentKey);
      seen.add(x as NewsSegmentKey);
    }
  }
  for (const k of NEWS_SEGMENT_ORDER) {
    if (!seen.has(k)) out.push(k);
  }
  return out;
}
