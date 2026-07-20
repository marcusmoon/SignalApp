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

/** 오늘 회차 진행 순서 — 이미 올라온 더 늦은 회차가 있으면 그걸 쓴다. */
export const HOME_HERO_DAY_PROGRESSION: readonly HomeHeroTarget[] = [
  { market: 'us', session: 'overnight' },
  { market: 'kr', session: 'morning' },
  { market: 'kr', session: 'lunch' },
  { market: 'kr', session: 'close' },
  'today',
];

export function heroTargetKey(target: HomeHeroTarget): string {
  if (target === 'today') return 'today';
  return `${target.market}:${target.session}`;
}

export function heroTargetRank(target: HomeHeroTarget): number {
  const key = heroTargetKey(target);
  return HOME_HERO_DAY_PROGRESSION.findIndex((row) => heroTargetKey(row) === key);
}

/**
 * KST 창의 기본 회차 이상(같거나 더 늦은) 회차 중, 이미 있는 것 중 가장 늦은 회차.
 * 예: 12:20에 morning 창이어도 lunch가 있으면 lunch.
 */
export function selectTodayHeroTarget(
  preferred: HomeHeroTarget,
  available: readonly HomeHeroTarget[],
): HomeHeroTarget | null {
  const minRank = heroTargetRank(preferred);
  if (minRank < 0) return available[0] ?? null;
  let best: HomeHeroTarget | null = null;
  let bestRank = -1;
  for (const target of available) {
    const rank = heroTargetRank(target);
    if (rank < minRank) continue;
    if (rank >= bestRank) {
      best = target;
      bestRank = rank;
    }
  }
  return best;
}

/** 선호 회차가 없을 때 같은 날 후보 중 더 이른 회차로 폴백. */
export function fallbackSameDayTarget(
  preferred: HomeHeroTarget,
  available: readonly HomeHeroTarget[],
): HomeHeroTarget | null {
  const availableKeys = new Set(available.map(heroTargetKey));
  const startRank = heroTargetRank(preferred);
  if (startRank < 0) return null;
  for (let rank = startRank; rank >= 0; rank -= 1) {
    const target = HOME_HERO_DAY_PROGRESSION[rank];
    if (availableKeys.has(heroTargetKey(target))) return target;
  }
  return null;
}

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

/**
 * Today hero window (KST).
 * lunch 창은 자동화 스케줄(12:10)에 맞춰 12:10부터.
 */
export function preferredHeroTargetForKstMinutes(minutes: number): HomeHeroTarget {
  if (minutes < 9 * 60) return { market: 'us', session: 'overnight' };
  if (minutes < 12 * 60 + 10) return { market: 'kr', session: 'morning' };
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
