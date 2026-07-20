import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import { HOME_SIGNAL_SESSIONS } from '@/constants/ipadHomeNav';
import { briefingsForYmd, matchesBriefingYmd } from '@/domain/home/briefingDate';
import {
  fallbackSameDayTarget,
  hasTodayBriefingContent,
  HOME_HERO_DAY_PROGRESSION,
  kstMinutesSinceMidnight,
  preferredHeroTargetForKstMinutes,
  selectTodayHeroTarget,
  type HomeHeroTarget,
} from '@/domain/home/homeHeroRules';
import type {
  SignalApiMarketBriefing,
  SignalApiTodayBriefing,
} from '@/integrations/signal-api/types';

export type HomeHeroSelection =
  | { kind: 'today'; briefing: SignalApiTodayBriefing }
  | { kind: 'market'; briefing: SignalApiMarketBriefing; sessionKey: SignalSessionKey };

export {
  hasTodayBriefingContent,
  kstMinutesSinceMidnight,
  preferredHeroTargetForKstMinutes,
  selectTodayHeroTarget,
};

type HeroTarget = HomeHeroTarget;

const ARCHIVE_ORDER: HeroTarget[] = [
  'today',
  { market: 'kr', session: 'close' },
  { market: 'kr', session: 'lunch' },
  { market: 'kr', session: 'morning' },
  { market: 'us', session: 'overnight' },
];

function sessionKeyFor(row: SignalApiMarketBriefing): SignalSessionKey | undefined {
  return HOME_SIGNAL_SESSIONS.find(
    (session) => session.market === row.market && session.session === row.session,
  )?.key;
}

function findMarketBriefing(
  briefings: SignalApiMarketBriefing[],
  market: string,
  session: string,
): SignalApiMarketBriefing | null {
  return (
    briefings.find(
      (row) =>
        String(row.market || '').toLowerCase() === market &&
        String(row.session || '').toLowerCase() === session,
    ) ?? null
  );
}

function usableTodayBriefing(
  todayBriefing: SignalApiTodayBriefing | null,
  selectedYmd: string,
): SignalApiTodayBriefing | null {
  if (!hasTodayBriefingContent(todayBriefing)) return null;
  if (!matchesBriefingYmd(todayBriefing, selectedYmd)) return null;
  return todayBriefing;
}

function resolveTarget(
  target: HeroTarget,
  todayBriefing: SignalApiTodayBriefing | null,
  briefings: SignalApiMarketBriefing[],
  selectedYmd: string,
): HomeHeroSelection | null {
  if (target === 'today') {
    const row = usableTodayBriefing(todayBriefing, selectedYmd);
    return row ? { kind: 'today', briefing: row } : null;
  }
  const row = findMarketBriefing(briefings, target.market, target.session);
  if (!row) return null;
  const sessionKey = sessionKeyFor(row);
  if (!sessionKey) return null;
  return { kind: 'market', briefing: row, sessionKey };
}

/** 선호 회차가 아직 없으면 같은 날 더 이른 회차로 폴백. */
function fallbackSameDayHero(
  preferred: HomeHeroTarget,
  todayBriefing: SignalApiTodayBriefing | null,
  briefings: SignalApiMarketBriefing[],
  selectedYmd: string,
): HomeHeroSelection | null {
  const available = HOME_HERO_DAY_PROGRESSION.filter((target) =>
    Boolean(resolveTarget(target, todayBriefing, briefings, selectedYmd)),
  );
  const target = fallbackSameDayTarget(preferred, available);
  return target ? resolveTarget(target, todayBriefing, briefings, selectedYmd) : null;
}

/**
 * Home hero: one briefing card.
 * - Today: KST 기본 회차 이상에서 이미 올라온 가장 늦은 회차 (장중이 있으면 장전보다 우선).
 * - Past: today_briefing → kr/close → lunch → morning → us/overnight.
 * - 항상 selectedYmd(briefingDate)와 일치하는 항목만 사용.
 */
export function selectHomeHeroBriefing(args: {
  selectedYmd: string;
  todayYmd: string;
  todayBriefing: SignalApiTodayBriefing | null;
  briefings: SignalApiMarketBriefing[];
  now?: Date;
}): HomeHeroSelection | null {
  const { selectedYmd, todayYmd, todayBriefing, briefings, now = new Date() } = args;
  const dayBriefings = briefingsForYmd(briefings, selectedYmd);
  const scopedToday = usableTodayBriefing(todayBriefing, selectedYmd);
  const isToday = selectedYmd === todayYmd;

  if (isToday) {
    const preferred = preferredHeroTargetForKstMinutes(kstMinutesSinceMidnight(now));
    const available = HOME_HERO_DAY_PROGRESSION.filter((target) =>
      Boolean(resolveTarget(target, scopedToday, dayBriefings, selectedYmd)),
    );
    const chosen = selectTodayHeroTarget(preferred, available);
    return (
      (chosen ? resolveTarget(chosen, scopedToday, dayBriefings, selectedYmd) : null) ??
      fallbackSameDayHero(preferred, scopedToday, dayBriefings, selectedYmd)
    );
  }

  for (const target of ARCHIVE_ORDER) {
    const hit = resolveTarget(target, scopedToday, dayBriefings, selectedYmd);
    if (hit) return hit;
  }
  return null;
}

/** One-line insight for the hero card. */
export function homeHeroHeadline(hero: HomeHeroSelection): string {
  if (hero.kind === 'today') {
    return (
      hero.briefing.headline?.trim() ||
      hero.briefing.summary?.trim() ||
      hero.briefing.title?.trim() ||
      ''
    );
  }
  const headline = String(hero.briefing.headline || '').trim();
  if (headline) return headline;
  const summary = String(hero.briefing.summary || '').trim();
  if (summary) return summary;
  return hero.briefing.overview[0] || '';
}
