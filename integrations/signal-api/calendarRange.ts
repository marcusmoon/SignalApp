import { fetchSignalCalendar } from '@/integrations/signal-api/calendar';
import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import { toYmd } from '@/utils/date';

function calendarEventSortKey(ev: SignalApiCalendarEvent): string {
  const iso = ev.eventAt?.trim();
  if (iso && iso.includes('T')) return iso;
  if (ev.date && ev.timeLabel) return `${ev.date}T${ev.timeLabel}`;
  if (ev.date) return `${ev.date}T00:00:00`;
  return '';
}

export async function fetchSignalMacroCalendarRangeMerged(
  from: Date,
  to: Date,
): Promise<SignalApiCalendarEvent[]> {
  const rows = await fetchSignalCalendar({
    from: toYmd(from),
    to: toYmd(to),
  });
  return rows
    .filter((r) => r.type !== 'earnings')
    .filter((r) => calendarEventSortKey(r).length >= 10)
    .sort((a, b) => calendarEventSortKey(a).localeCompare(calendarEventSortKey(b)));
}

export async function fetchSignalEarningsCalendarRangeMerged(
  from: Date,
  to: Date,
): Promise<SignalApiCalendarEvent[]> {
  const rows = await fetchSignalCalendar({
    from: toYmd(from),
    to: toYmd(to),
    type: 'earnings',
  });
  return [...rows].sort((a, b) => {
    const da = String(a.date || '').localeCompare(String(b.date || ''));
    if (da !== 0) return da;
    return String(a.symbol || '').localeCompare(String(b.symbol || ''));
  });
}
