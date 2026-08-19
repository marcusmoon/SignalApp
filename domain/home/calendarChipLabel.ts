import type { CalendarEvent } from '../../types/signal.ts';
import { addDays, calendarEventDisplayYmd, parseLocalYmd, toYmd } from '../../utils/date.ts';

/** Days from baseYmd to event display YMD (positive = event is in the future). */
export function daysUntilEventYmd(baseYmd: string, eventYmd: string): number {
  const base = parseLocalYmd(baseYmd).getTime();
  const event = parseLocalYmd(eventYmd).getTime();
  return Math.round((event - base) / (24 * 60 * 60 * 1000));
}

/**
 * Chip label like `D-2 FOMC`.
 * - Future/today relative to base: `D-Day` / `D-1` / `D-2` …
 * - Past relative: type/title only (no countdown tone).
 */
export function homeCalendarChipLabel(
  event: CalendarEvent,
  baseYmd: string,
  typeLabel: string,
): string {
  const eventYmd = calendarEventDisplayYmd(event);
  const days = daysUntilEventYmd(baseYmd, eventYmd);
  const short =
    typeLabel.trim() ||
    event.symbol?.trim() ||
    event.title.trim().slice(0, 12) ||
    '—';
  if (days < 0) return short;
  if (days === 0) return `D-Day ${short}`;
  return `D-${days} ${short}`;
}

export function filterCalendarChipsForHome(
  events: CalendarEvent[],
  selectedYmd: string,
  todayYmd: string,
  limit: number,
): CalendarEvent[] {
  const isToday = selectedYmd === todayYmd;
  const scoped = isToday
    ? events
    : events.filter((event) => calendarEventDisplayYmd(event) === selectedYmd);
  return scoped.slice(0, limit);
}

export const HOME_CALENDAR_TODAY_LIMIT = 4;
export const HOME_CALENDAR_UPCOMING_LIMIT = 4;

export type HomeCalendarAgenda = {
  today: CalendarEvent[];
  upcoming: CalendarEvent[];
};

/** Selected-day rows + (today only) upcoming countdown chips. */
export function splitHomeCalendarAgenda(
  events: CalendarEvent[],
  selectedYmd: string,
  todayYmd: string,
  todayLimit = HOME_CALENDAR_TODAY_LIMIT,
  upcomingLimit = HOME_CALENDAR_UPCOMING_LIMIT,
): HomeCalendarAgenda {
  const today: CalendarEvent[] = [];
  const upcoming: CalendarEvent[] = [];
  const allowUpcoming = selectedYmd === todayYmd;

  for (const event of events) {
    const ymd = calendarEventDisplayYmd(event);
    if (ymd === selectedYmd) {
      if (today.length < todayLimit) today.push(event);
      continue;
    }
    if (allowUpcoming && ymd > selectedYmd && upcoming.length < upcomingLimit) {
      upcoming.push(event);
    }
  }

  return { today, upcoming };
}

export function homeCalendarAgendaIsEmpty(agenda: HomeCalendarAgenda): boolean {
  return agenda.today.length === 0 && agenda.upcoming.length === 0;
}

/** Lookahead end for today home chips (inclusive). */
export function homeCalendarChipRangeEnd(selectedYmd: string, lookaheadDays: number): string {
  return toYmd(addDays(parseLocalYmd(selectedYmd), lookaheadDays));
}
