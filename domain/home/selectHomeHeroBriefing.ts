import type { SignalSessionKey } from '@/constants/ipadHomeNav';
import { HOME_SIGNAL_SESSIONS } from '@/constants/ipadHomeNav';
import {
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
): SignalApiTodayBriefing | null {
  return hasTodayBriefingContent(todayBriefing) ? todayBriefing : null;
}

function resolveTarget(
  target: HeroTarget,
  todayBriefing: SignalApiTodayBriefing | null,
  briefings: SignalApiMarketBriefing[],
): HomeHeroSelection | null {
  if (target === 'today') {
    const row = usableTodayBriefing(todayBriefing);
    return row ? { kind: 'today', briefing: row } : null;
  }
  const row = findMarketBriefing(briefings, target.market, target.session);
  if (!row) return null;
  const sessionKey = sessionKeyFor(row);
  if (!sessionKey) return null;
  return { kind: 'market', briefing: row, sessionKey };
}

function publishedSortKey(iso: string | null | undefined, fallbackDate: string | null | undefined): string {
  return String(iso || fallbackDate || '');
}

/** Latest published item that day (today_briefing or any market session). */
function latestPublishedHero(
  todayBriefing: SignalApiTodayBriefing | null,
  briefings: SignalApiMarketBriefing[],
): HomeHeroSelection | null {
  type Candidate = { at: string; hero: HomeHeroSelection };
  const candidates: Candidate[] = [];
  const usableToday = usableTodayBriefing(todayBriefing);
  if (usableToday) {
    candidates.push({
      at: publishedSortKey(
        usableToday.publishedAt || usableToday.generatedAt || usableToday.updatedAt,
        usableToday.briefingDate,
      ),
      hero: { kind: 'today', briefing: usableToday },
    });
  }
  for (const row of briefings) {
    const sessionKey = sessionKeyFor(row);
    if (!sessionKey) continue;
    candidates.push({
      at: publishedSortKey(row.publishedAt || row.updatedAt || row.createdAt, row.briefingDate),
      hero: { kind: 'market', briefing: row, sessionKey },
    });
  }
  candidates.sort((a, b) => b.at.localeCompare(a.at));
  return candidates[0]?.hero ?? null;
}

/**
 * Home hero: one briefing card.
 * - Today: KST 기본 회차 이상에서 이미 올라온 가장 늦은 회차 (장중이 있으면 장전보다 우선).
 * - Past: today_briefing → kr/close → lunch → morning → us/overnight.
 */
export function selectHomeHeroBriefing(args: {
  selectedYmd: string;
  todayYmd: string;
  todayBriefing: SignalApiTodayBriefing | null;
  briefings: SignalApiMarketBriefing[];
  now?: Date;
}): HomeHeroSelection | null {
  const { selectedYmd, todayYmd, todayBriefing, briefings, now = new Date() } = args;
  const isToday = selectedYmd === todayYmd;

  if (isToday) {
    const preferred = preferredHeroTargetForKstMinutes(kstMinutesSinceMidnight(now));
    const available = HOME_HERO_DAY_PROGRESSION.filter((target) =>
      Boolean(resolveTarget(target, todayBriefing, briefings)),
    );
    const chosen = selectTodayHeroTarget(preferred, available);
    return (
      (chosen ? resolveTarget(chosen, todayBriefing, briefings) : null) ??
      latestPublishedHero(todayBriefing, briefings)
    );
  }

  for (const target of ARCHIVE_ORDER) {
    const hit = resolveTarget(target, todayBriefing, briefings);
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
