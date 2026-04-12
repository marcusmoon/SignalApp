/**
 * 설정 UI 기본 시드. `koreaFilter.ts` 내장 정규식과 OR로 결합.
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
