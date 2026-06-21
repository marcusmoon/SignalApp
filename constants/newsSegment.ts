/** 뉴스 탭 상단 세그먼트 */
export type NewsSegmentKey = 'global' | 'korea' | 'crypto' | 'video' | 'watch';

export const DEFAULT_NEWS_SEGMENT: NewsSegmentKey = 'global';

export const NEWS_SEGMENT_ORDER: NewsSegmentKey[] = ['global', 'korea', 'crypto', 'watch', 'video'];

export function parseNewsSegmentKey(value: unknown): NewsSegmentKey | null {
  const key = String(value || '').trim();
  return (NEWS_SEGMENT_ORDER as readonly string[]).includes(key) ? (key as NewsSegmentKey) : null;
}
