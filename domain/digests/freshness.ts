/**
 * 다이제스트 신선도 규칙.
 * - 리스트(뉴스/공시 흐름 상세 등): 기본 2시간
 * - 홈 뉴스 흐름 섹션 NEW: 1시간 (생성 주기 2h의 전반만 강조)
 */

/** 리스트·상세 푸터 “최신” 기준 (기본 2시간) */
export const DIGEST_FRESH_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/** 홈 뉴스 흐름 섹션 헤더 NEW 기준 (1시간) */
export const HOME_NEWS_FLOW_NEW_THRESHOLD_MS = 60 * 60 * 1000;

/**
 * 다이제스트가 최근 생성되었는지 판단
 * @param generatedAt ISO 8601 날짜 문자열
 * @param thresholdMs 기준 시간 (밀리초). 기본값: 2시간
 * @param nowMs 기준 시각 (테스트용)
 */
export function isDigestFresh(
  generatedAt: string | null | undefined,
  thresholdMs: number = DIGEST_FRESH_THRESHOLD_MS,
  nowMs: number = Date.now(),
): boolean {
  if (!generatedAt) return false;

  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(generated)) return false;

  const ageMs = nowMs - generated;
  return ageMs >= 0 && ageMs <= thresholdMs;
}

/** 홈 뉴스 흐름 섹션 NEW — 최신 항목 `generatedAt`이 1시간 이내 */
export function isHomeNewsFlowNew(
  generatedAt: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  return isDigestFresh(generatedAt, HOME_NEWS_FLOW_NEW_THRESHOLD_MS, nowMs);
}

/**
 * 다이제스트 생성 경과 시간 (밀리초)
 */
export function getDigestAgeMs(
  generatedAt: string | null | undefined,
  nowMs: number = Date.now(),
): number | null {
  if (!generatedAt) return null;

  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(generated)) return null;

  return nowMs - generated;
}
