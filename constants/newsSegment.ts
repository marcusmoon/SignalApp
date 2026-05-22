/** 뉴스 탭 상단 세그먼트 */
export type NewsSegmentKey = 'global' | 'crypto' | 'video' | 'watch';

export const DEFAULT_NEWS_SEGMENT: NewsSegmentKey = 'global';

export const NEWS_SEGMENT_ORDER: NewsSegmentKey[] = ['global', 'crypto', 'watch', 'video'];
