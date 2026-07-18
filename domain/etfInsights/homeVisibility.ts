import { parseLocalYmd } from '@/utils/date';

/** 주간 ETF 브리핑 — 홈에 고정 섹션을 두지 않고, 이 기간 안일 때만 카드 노출 */
export const ETF_BRIEFING_HOME_MAX_AGE_DAYS = 7;

/**
 * 선택일 기준 최신 브리핑이 “이번 주 읽을거리”인지.
 * insightDate ≤ selectedYmd 이고 경과일이 maxAgeDays 이하여야 홈에 보인다.
 */
export function shouldShowEtfBriefingOnHome(
  insightDate: string | null | undefined,
  selectedYmd: string,
  maxAgeDays: number = ETF_BRIEFING_HOME_MAX_AGE_DAYS,
): boolean {
  const insight = String(insightDate || '').trim();
  const selected = String(selectedYmd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(insight) || !/^\d{4}-\d{2}-\d{2}$/.test(selected)) return false;
  if (insight > selected) return false;
  const ms = parseLocalYmd(selected).getTime() - parseLocalYmd(insight).getTime();
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return days >= 0 && days <= maxAgeDays;
}
