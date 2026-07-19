/**
 * 홈 히어로 선택 순수 규칙 — 빈 오늘 정리 제외 · KST 회차 창.
 * (UI/세션 맵과 분리해 회귀 테스트 대상)
 */

export type HomeHeroMarketTarget = { market: 'us' | 'kr'; session: string };
export type HomeHeroTarget = 'today' | HomeHeroMarketTarget;

export type TodayBriefingContentFields = {
  headline?: string | null;
  summary?: string | null;
  keyPoints?: unknown;
};

/** Asia/Seoul wall-clock minutes since midnight. */
export function kstMinutesSinceMidnight(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/** Today hero window (KST): overnight → morning → lunch → close → today_briefing. */
export function preferredHeroTargetForKstMinutes(minutes: number): HomeHeroTarget {
  if (minutes < 9 * 60) return { market: 'us', session: 'overnight' };
  if (minutes < 12 * 60 + 30) return { market: 'kr', session: 'morning' };
  if (minutes < 15 * 60 + 30) return { market: 'kr', session: 'lunch' };
  if (minutes < 23 * 60) return { market: 'kr', session: 'close' };
  return 'today';
}

/** 오늘 정리에 읽을 본문이 있을 때만 히어로 후보. */
export function hasTodayBriefingContent(
  briefing: TodayBriefingContentFields | null | undefined,
): boolean {
  if (!briefing) return false;
  if (briefing.headline?.trim()) return true;
  if (briefing.summary?.trim()) return true;
  if (Array.isArray(briefing.keyPoints) && briefing.keyPoints.some((p) => String(p || '').trim())) {
    return true;
  }
  return false;
}
