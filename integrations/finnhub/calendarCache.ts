import { normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api/calendar';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import type { CalendarEvent } from '@/types/signal';
import { toYmd } from '@/utils/date';

/** Finnhub merged calendar — in-memory cache TTL */
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
  const from = options.rangeFrom ?? new Date();
  const to = options.rangeTo ?? new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  if (!cacheEnabled) {
    const rows = await fetchSignalCalendar({ from: toYmd(from), to: toYmd(to) });
    return rows.map(signalCalendarToCalendarEvent);
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

  const events = (await fetchSignalCalendar({ from: toYmd(from), to: toYmd(to) })).map(signalCalendarToCalendarEvent);
  store(key, events);
  return events;
}
