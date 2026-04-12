import type { NewsSegmentKey } from '@/constants/newsSegment';
import { NEWS_SEGMENT_ORDER } from '@/constants/newsSegment';

const ALL_KEYS: NewsSegmentKey[] = ['global', 'korea', 'crypto'];

export function normalizeNewsSegmentOrder(raw: unknown): NewsSegmentKey[] {
  if (!Array.isArray(raw)) return [...NEWS_SEGMENT_ORDER];
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
