/**
 * 뉴스 탭 세그먼트 — 키·기본 순서는 `domain/news/segmentOrder` (Node 테스트 가능).
 * 앱·설정은 이 모듈을 통해 import.
 */
export {
  DEFAULT_NEWS_SEGMENT,
  NEWS_SEGMENT_ORDER,
  parseNewsSegmentKey,
  type NewsSegmentKey,
} from '@/domain/news/segmentOrder';

import type { NewsSegmentKey } from '@/domain/news/segmentOrder';

/** 기사 피드 세그먼트 (YouTube 제외) */
export const NEWS_ARTICLE_SEGMENTS: readonly NewsSegmentKey[] = [
  'all',
  'global',
  'korea',
  'crypto',
  'it',
];
