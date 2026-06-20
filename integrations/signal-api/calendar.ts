import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiCalendarDateSummary, SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import {
  buildSignalCalendarCacheKey,
  buildSignalCalendarDatesCacheKey,
  peekSignalCalendarCache,
  peekSignalCalendarDatesCache,
  storeSignalCalendarCache,
  storeSignalCalendarDatesCache,
} from '@/integrations/signal-api/cache/calendarCache';
import type { CalendarEvent } from '@/types/signal';

export async function fetchSignalCalendar(
  params?: {
    from?: string;
    to?: string;
    type?: string;
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
    const date = String(item.date || item.eventAt || '').slice(0, 10);
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
      title: item.title,
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
      title: item.title,
      type: 'holiday',
      country: item.country || undefined,
    };
  }
  if (item.type !== 'macro' && item.type !== 'fed' && item.type !== 'fomc') return null;
  return {
    id: item.id,
    date: item.date || '—',
    time: item.timeLabel || '—',
    title: item.title,
    type: item.type,
    impact: item.impact || undefined,
    actual: item.actual,
    estimate: item.estimate,
    prev: item.previous,
    unit: item.unit || undefined,
    country: item.country || undefined,
  };
}
