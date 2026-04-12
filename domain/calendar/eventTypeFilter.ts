import type { CalendarEvent } from '@/types/signal';

export type CalendarEventTypeKey = CalendarEvent['type'];

export const CALENDAR_EVENT_TYPE_ORDER: CalendarEventTypeKey[] = [
  'earnings',
  'macro',
  'fed',
  'fomc',
];

const ALL_SET = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);

export function normalizeCalendarEventTypeFilterStored(raw: unknown): Set<CalendarEventTypeKey> {
  if (!Array.isArray(raw)) return new Set(ALL_SET);
  const next = new Set<CalendarEventTypeKey>();
  for (const x of raw) {
    if (CALENDAR_EVENT_TYPE_ORDER.includes(x as CalendarEventTypeKey)) {
      next.add(x as CalendarEventTypeKey);
    }
  }
  if (next.size === 0) return new Set(ALL_SET);
  return next;
}
