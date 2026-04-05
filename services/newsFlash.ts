import type { FinnhubNewsRaw } from '@/services/finnhub';

/** 키워드: 글로벌 속보·긴급 보도 흔적 */
const FLASH_KEYWORD_RE =
  /breaking|flash|속보|긴급|urgent|live\s*:|market\s*alert|just\s*in|developing|exclusive:/i;

/** 이 시간 이내 기사는 실시간 피드에서 속보로 간주 (키워드 없이도 최신성 강조) */
const FLASH_MAX_AGE_MS = 18 * 60 * 1000;

/**
 * Finnhub 기사가 속보(플래시)로 표시할지 판별합니다.
 * - 제목·요약·카테고리에 긴급 키워드가 있거나
 * - 카테고리에 breaking/flash 계열이 있거나
 * - 매우 최근(기본 18분 이내)이면 실시간 속보로 강조
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
