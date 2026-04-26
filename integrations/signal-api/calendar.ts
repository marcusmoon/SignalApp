import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import type { CalendarEvent } from '@/types/signal';

export async function fetchSignalCalendar(params?: {
  from?: string;
  to?: string;
  type?: string;
}): Promise<SignalApiCalendarEvent[]> {
  const json = await signalApi<{ data: SignalApiCalendarEvent[] }>('/v1/calendar', params);
  return json.data;
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
