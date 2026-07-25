/**
 * 다이제스트 최근 갱신 판단 로직
 * 
 * 뉴스 다이제스트는 하루 6번(약 4시간 간격) 갱신됨.
 * 갱신 주기의 절반인 2시간을 "최근(fresh)" 기준으로 사용.
 */

/** 최근 갱신 기준 (밀리초) - 기본 2시간 */
export const DIGEST_FRESH_THRESHOLD_MS = 2 * 60 * 60 * 1000;

/**
 * 다이제스트가 최근 생성되었는지 판단
 * @param generatedAt ISO 8601 날짜 문자열
 * @param thresholdMs 기준 시간 (밀리초). 기본값: 2시간
 * @returns 최근 생성 여부
 */
export function isDigestFresh(
  generatedAt: string | null | undefined,
  thresholdMs: number = DIGEST_FRESH_THRESHOLD_MS,
): boolean {
  if (!generatedAt) return false;
  
  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(generated)) return false;
  
  const now = Date.now();
  const ageMs = now - generated;
  
  return ageMs >= 0 && ageMs <= thresholdMs;
}

/**
 * 다이제스트 생성 경과 시간 (밀리초)
 */
export function getDigestAgeMs(generatedAt: string | null | undefined): number | null {
  if (!generatedAt) return null;
  
  const generated = new Date(generatedAt).getTime();
  if (!Number.isFinite(generated)) return null;
  
  return Date.now() - generated;
}
