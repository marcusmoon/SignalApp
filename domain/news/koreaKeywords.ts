const MAX_KEYWORDS = 80;
const MAX_KEYWORD_LEN = 120;

/**
 * 설정 UI 기본 시드. `domain/news/koreaFilter.ts` 내장 정규식과 OR로 결합.
 * AsyncStorage 시드는 `services/newsKoreaKeywordsPreference.ts`에서 처리.
 */
export const DEFAULT_KOREA_NEWS_KEYWORDS: string[] = [
  'KOREA',
  'KOSPI',
  'KOSDAQ',
  /** KRX 시총 상위권 — Finnhub 헤드라인·요약에 자주 나오는 영문 표기 */
  'Samsung Electronics',
  'SK Hynix',
  'LG Energy Solution',
  'Hyundai Motor',
  'KB Financial',
  'Shinhan',
  'Samsung Biologics',
  'Celltrion',
  'NAVER',
  'Kakao',
];

/** Trim, dedupe (case-insensitive), cap count/length; empty strings dropped. */
export function normalizeKoreaNewsExtraKeywords(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string') continue;
    const t = x.trim().slice(0, MAX_KEYWORD_LEN);
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}
