/**
 * 뉴스 탭 세그먼트 키·기본 순서 (순수 — Node 테스트 가능).
 * `all` = global+korea+crypto+it (video 제외).
 */

export const NEWS_SEGMENT_KEYS = ['all', 'global', 'korea', 'crypto', 'it', 'video'] as const;
export type NewsSegmentKey = (typeof NEWS_SEGMENT_KEYS)[number];

export const NEWS_SEGMENT_ORDER: NewsSegmentKey[] = [...NEWS_SEGMENT_KEYS];

export const DEFAULT_NEWS_SEGMENT: NewsSegmentKey = 'all';

const ALL_KEYS: NewsSegmentKey[] = [...NEWS_SEGMENT_ORDER];

function isSameOrder(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function normalizeNewsSegmentOrder(raw: unknown): NewsSegmentKey[] {
  if (!Array.isArray(raw)) return [...NEWS_SEGMENT_ORDER];
  /**
   * 과거 기본 순서(Watch 포함 · `all` 도입 전 · `all`이 끝에 붙인 마이그레이션).
   * 필터 전에 raw와 비교해 신규 기본값으로 리셋한다.
   */
  const previousDefaults: readonly (readonly string[])[] = [
    ['watch', 'global', 'crypto'],
    ['global', 'crypto', 'watch'],
    ['global', 'crypto', 'video', 'watch'],
    ['global', 'korea', 'crypto', 'video', 'watch'],
    ['global', 'korea', 'crypto', 'watch', 'video'],
    ['global', 'korea', 'crypto', 'it', 'video'],
    /** `all` 추가 시 missing append로 맨 뒤에 붙은 기본형 */
    ['global', 'korea', 'crypto', 'it', 'video', 'all'],
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
  /** 새로 생긴 키: `all`은 맨 앞, 그 외는 뒤에 (의도적 커스텀 순서는 유지) */
  for (const k of NEWS_SEGMENT_ORDER) {
    if (seen.has(k)) continue;
    if (k === 'all') out.unshift(k);
    else out.push(k);
    seen.add(k);
  }
  return out;
}

export function parseNewsSegmentKey(value: unknown): NewsSegmentKey | null {
  const key = String(value || '').trim();
  return (NEWS_SEGMENT_ORDER as readonly string[]).includes(key) ? (key as NewsSegmentKey) : null;
}
