/** 시세 탭 상단 세그먼트 키·기본 순서 */
export const QUOTES_SEGMENT_KEYS = ['watch', 'popular', 'mcap', 'coin'] as const;
export type QuoteSegmentKey = (typeof QUOTES_SEGMENT_KEYS)[number];

export const DEFAULT_QUOTES_SEGMENT_ORDER: QuoteSegmentKey[] = [...QUOTES_SEGMENT_KEYS];

/** 시세 탭 목록 길이(인기·시총·코인) */
export type QuotesListLimits = {
  popularMax: number;
  mcapMax: number;
  coinMax: number;
};

export const QUOTES_COUNT_MIN = 10;
export const QUOTES_COUNT_MAX = 100;
export const QUOTES_COUNT_STEP = 10;

export const QUOTES_LIST_LIMIT_BOUNDS = {
  popular: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
  mcap: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
  coin: { min: QUOTES_COUNT_MIN, max: QUOTES_COUNT_MAX },
} as const;

export const QUOTES_LIST_LIMITS_DEFAULTS: QuotesListLimits = {
  popularMax: 20,
  mcapMax: 20,
  coinMax: 20,
};
