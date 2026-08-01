/** 뉴스 탭 상단 세그먼트 (`all` = global+korea+crypto+it, video 제외) */
export type NewsSegmentKey = 'all' | 'global' | 'korea' | 'crypto' | 'it' | 'video';

export const DEFAULT_NEWS_SEGMENT: NewsSegmentKey = 'all';

export const NEWS_SEGMENT_ORDER: NewsSegmentKey[] = [
  'all',
  'global',
  'korea',
  'crypto',
  'it',
  'video',
];

/** 기사 피드 세그먼트 (YouTube 제외) */
export const NEWS_ARTICLE_SEGMENTS: readonly NewsSegmentKey[] = [
  'all',
  'global',
  'korea',
  'crypto',
  'it',
];

export function parseNewsSegmentKey(value: unknown): NewsSegmentKey | null {
  const key = String(value || '').trim();
  return (NEWS_SEGMENT_ORDER as readonly string[]).includes(key) ? (key as NewsSegmentKey) : null;
}
