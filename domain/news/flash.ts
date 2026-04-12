import type { FinnhubNewsRaw } from '@/integrations/finnhub/types';

/** 키워드: 글로벌 속보·긴급 보도 흔적 */
const FLASH_KEYWORD_RE =
  /breaking|flash|속보|긴급|urgent|live\s*:|market\s*alert|just\s*in|developing|exclusive:/i;

/** 이 시간 이내 기사는 실시간 피드에서 속보로 간주 (키워드 없이도 최신성 강조) */
const FLASH_MAX_AGE_MS = 18 * 60 * 1000;

/**
 * Finnhub 기사가 속보(플래시)로 표시할지 판별합니다.
 * 외부 HTTP 없음 — 도메인 규칙만.
 */
export function isFlashNews(n: FinnhubNewsRaw, nowMs = Date.now()): boolean {
  const blob = `${n.headline ?? ''} ${n.category ?? ''} ${n.summary ?? ''}`;
  if (FLASH_KEYWORD_RE.test(blob)) return true;

  const cat = (n.category || '').toLowerCase();
  if (cat.includes('breaking') || cat.includes('flash') || cat.includes('hot')) return true;

  const ageMs = nowMs - n.datetime * 1000;
  if (ageMs >= 0 && ageMs <= FLASH_MAX_AGE_MS) return true;

  return false;
}
