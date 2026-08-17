import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiCalendarDateSummary, SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import { mergeSignalCalendarEvents } from '@/domain/calendar/mergeCalendarEvents';
import { CALENDAR_NON_EARNINGS_TYPES } from '@/domain/calendar/constants';
import { normalizeCalendarWatchlistSymbols } from '@/domain/calendar/calendarWatchlistEarnings';
import {
  buildSignalCalendarCacheKey,
  buildSignalCalendarDatesCacheKey,
  peekSignalCalendarCache,
  peekSignalCalendarDatesCache,
  storeSignalCalendarCache,
  storeSignalCalendarDatesCache,
} from '@/integrations/signal-api/cache/calendarCache';
import type { CalendarEvent } from '@/types/signal';
import { calendarEventDisplayYmd } from '@/utils/date';

export { mergeSignalCalendarEvents } from '@/domain/calendar/mergeCalendarEvents';

const CALENDAR_SCREEN_NON_EARNINGS_LIMIT = 500;
const CALENDAR_SCREEN_EARNINGS_PER_SYMBOL_LIMIT = 4;
const CALENDAR_WATCHLIST_EARNINGS_CONCURRENCY = 6;

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

export async function fetchSignalWatchlistCalendarEarnings(
  params: {
    from?: string;
    to?: string;
    watchlistSymbols: readonly string[];
    limitPerSymbol?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarEvent[]> {
  const symbols = normalizeCalendarWatchlistSymbols(params.watchlistSymbols);
  if (symbols.length === 0) return [];
  const limit = params.limitPerSymbol ?? CALENDAR_SCREEN_EARNINGS_PER_SYMBOL_LIMIT;
  const batches = await mapWithConcurrency(symbols, CALENDAR_WATCHLIST_EARNINGS_CONCURRENCY, (symbol) =>
    fetchSignalCalendar(
      {
        from: params.from,
        to: params.to,
        type: 'earnings',
        symbol,
        limit,
      },
      options,
    ),
  );
  return mergeSignalCalendarEvents(batches);
}

/**
 * One event_date window: macro/FOMC/holiday in full; earnings limited to watchlist symbols.
 */
export async function fetchSignalCalendarScreenRange(
  params: {
    from: string;
    to: string;
    watchlistSymbols: readonly string[];
    typeFilter?: string;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarEvent[]> {
  const typeFilter = String(params.typeFilter || '').trim().toLowerCase();
  const { from, to, watchlistSymbols } = params;

  if (typeFilter === 'earnings') {
    return fetchSignalWatchlistCalendarEarnings({ from, to, watchlistSymbols }, options);
  }

  if (typeFilter && typeFilter !== 'earnings') {
    return fetchSignalCalendar(
      {
        from,
        to,
        type: typeFilter,
        limit: CALENDAR_SCREEN_NON_EARNINGS_LIMIT,
      },
      options,
    );
  }

  const [nonEarningsRows, earningsRows] = await Promise.all([
    fetchSignalCalendarMerged(
      {
        from,
        to,
        types: CALENDAR_NON_EARNINGS_TYPES,
        limitPerType: CALENDAR_SCREEN_NON_EARNINGS_LIMIT,
      },
      options,
    ),
    fetchSignalWatchlistCalendarEarnings({ from, to, watchlistSymbols }, options),
  ]);
  return mergeSignalCalendarEvents([nonEarningsRows, earningsRows]);
}

/** When several types are requested, fetch each type so earnings do not crowd out macro/holiday rows. */
export async function fetchSignalCalendarMerged(
  params: {
    from?: string;
    to?: string;
    types: readonly string[];
    limitPerType?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarEvent[]> {
  const types = params.types.map((type) => String(type || '').trim()).filter(Boolean);
  if (types.length === 0) return [];
  const limit = params.limitPerType ?? 1000;
  if (types.length === 1) {
    return fetchSignalCalendar({ from: params.from, to: params.to, type: types[0], limit }, options);
  }
  const batches = await Promise.all(
    types.map((type) => fetchSignalCalendar({ from: params.from, to: params.to, type, limit }, options)),
  );
  return mergeSignalCalendarEvents(batches);
}

export async function fetchSignalCalendar(
  params?: {
    from?: string;
    to?: string;
    type?: string;
    symbol?: string;
    limit?: number;
    offset?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarEvent[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalCalendarCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalCalendarCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiCalendarEvent[] }>('/v1/calendar', params, {
    timeoutMs: 6000,
    attempts: 1,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalCalendarCache(cacheKey, rows);
  return rows;
}

export async function fetchSignalCalendarDateSummaries(
  params?: {
    from?: string;
    to?: string;
    type?: string;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarDateSummary[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalCalendarDatesCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalCalendarDatesCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiCalendarDateSummary[] }>('/v1/calendar-dates', params, {
    timeoutMs: 6000,
    attempts: 1,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalCalendarDatesCache(cacheKey, rows);
  return rows;
}

export function signalCalendarDateSummariesFromEvents(
  items: SignalApiCalendarEvent[],
): SignalApiCalendarDateSummary[] {
  const byDate = new Map<string, SignalApiCalendarDateSummary>();

  for (const item of items) {
    const date = calendarEventDisplayYmd(item);
    if (!date) continue;

    const current = byDate.get(date) || {
      date,
      total: 0,
      counts: {},
    };
    current.total += 1;
    current.counts[item.type] = (current.counts[item.type] || 0) + 1;
    byDate.set(date, current);
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function signalCalendarToCalendarEvent(item: SignalApiCalendarEvent): CalendarEvent | null {
  if (item.type === 'earnings') {
    return {
      id: item.id,
      date: item.date || '—',
      time: item.timeLabel || item.earningsHour || '—',
      eventAt: item.eventAt,
      timezone: item.timezone,
      title: item.title,
      provider: item.provider || null,
      type: 'earnings',
      actual: item.actual,
      estimate: item.estimate,
      prev: item.previous,
      unit: item.unit || 'EPS',
      symbol: item.symbol || null,
      fiscalYear: item.fiscalYear ?? null,
      fiscalQuarter: item.fiscalQuarter ?? null,
      earningsHour: item.earningsHour || null,
    };
  }
  if (item.type === 'holiday') {
    return {
      id: item.id,
      date: item.date || '—',
      time: item.timeLabel || '',
      eventAt: item.eventAt,
      timezone: item.timezone,
      title: item.title,
      provider: item.provider || null,
      type: 'holiday',
      country: item.country || undefined,
    };
  }
  if (item.type !== 'macro' && item.type !== 'fed' && item.type !== 'fomc') return null;
  return {
    id: item.id,
    date: item.date || '—',
    time: item.timeLabel || '—',
    eventAt: item.eventAt,
    timezone: item.timezone,
    title: item.title,
    provider: item.provider || null,
    type: item.type,
    impact: item.impact || undefined,
    actual: item.actual,
    estimate: item.estimate,
    prev: item.previous,
    unit: item.unit || undefined,
    country: item.country || undefined,
  };
}
