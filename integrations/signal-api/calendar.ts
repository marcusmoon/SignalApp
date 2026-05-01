import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import { buildSignalCalendarCacheKey, peekSignalCalendarCache, storeSignalCalendarCache } from '@/integrations/signal-api/cache/calendarCache';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import type { CalendarEvent } from '@/types/signal';

export async function fetchSignalCalendar(
  params?: {
  from?: string;
  to?: string;
  type?: string;
},
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiCalendarEvent[]> {
  const cacheMode = options?.cacheMode || 'use';
  const { calendarEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalCalendarCacheKey(params);
  if (cacheMode !== 'bypass' && calendarEnabled) {
    const hit = peekSignalCalendarCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiCalendarEvent[] }>('/v1/calendar', params);
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass' && calendarEnabled) storeSignalCalendarCache(cacheKey, rows);
  return rows;
}

export function signalCalendarToCalendarEvent(item: SignalApiCalendarEvent): CalendarEvent {
  return {
    id: item.id,
    date: item.date || '—',
    time: item.timeLabel || '—',
    earningsHourCode: item.type === 'earnings' ? item.earningsHour || undefined : undefined,
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
