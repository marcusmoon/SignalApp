import { normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import { fetchCalendarEventsMerged } from '@/services/finnhub';
import type { CalendarEvent } from '@/types/signal';
import { toYmd } from '@/utils/date';

/** 투자 캘린더 Finnhub 병합 결과 메모리 캐시 TTL */
export const CALENDAR_CACHE_TTL_MS = 15 * 60 * 1000;

type Entry = { events: CalendarEvent[]; expiresAt: number };

const cache = new Map<string, Entry>();

function watchSortedForKey(symbols: string[] | undefined, scope: CalendarConcallScope): string[] {
  if (scope !== 'watch') return [];
  return [...(symbols ?? [])]
    .map((s) => normalizeEarningsSymbolForMatch(s.trim().toUpperCase()))
    .filter(Boolean)
    .sort();
}

function buildCalendarCacheKey(
  daysAhead: number,
  scope: CalendarConcallScope,
  watchlistSymbols: string[] | undefined,
  rangeFrom?: Date,
  rangeTo?: Date,
): string {
  const w = watchSortedForKey(watchlistSymbols, scope).join(',');
  const rf = rangeFrom ? toYmd(rangeFrom) : '';
  const rt = rangeTo ? toYmd(rangeTo) : '';
  return `v2|${daysAhead}|${rf}|${rt}|${scope}|${w}`;
}

function peek(key: string): CalendarEvent[] | null {
  const e = cache.get(key);
  if (e && Date.now() < e.expiresAt) {
    return e.events;
  }
  return null;
}

function store(key: string, events: CalendarEvent[]): void {
  cache.set(key, { events, expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS });
}

function deleteKey(key: string): void {
  cache.delete(key);
}

export function clearCalendarCache(): void {
  cache.clear();
}

/**
 * `fetchCalendarEventsMerged`와 동일 인자에, 메모리 캐시(TTL)·강제 새로고침·설정 off 지원.
 */
export async function fetchCalendarEventsMergedCached(
  daysAhead: number,
  options: {
    scope: CalendarConcallScope;
    watchlistSymbols?: string[];
    rangeFrom?: Date;
    rangeTo?: Date;
  },
  opts?: { forceRefresh?: boolean; cacheEnabled?: boolean },
): Promise<CalendarEvent[]> {
  const cacheEnabled = opts?.cacheEnabled !== false;
  const scope = options.scope ?? 'mega';

  if (!cacheEnabled) {
    return fetchCalendarEventsMerged(daysAhead, options);
  }

  const key = buildCalendarCacheKey(
    daysAhead,
    scope,
    options.watchlistSymbols,
    options.rangeFrom,
    options.rangeTo,
  );

  if (opts?.forceRefresh) {
    deleteKey(key);
  } else {
    const hit = peek(key);
    if (hit) {
      return hit;
    }
  }

  const events = await fetchCalendarEventsMerged(daysAhead, options);
  store(key, events);
  return events;
}
