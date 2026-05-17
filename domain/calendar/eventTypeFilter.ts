import { CALENDAR_EVENT_TYPE_ORDER, type CalendarEventTypeKey } from './constants';

export { CALENDAR_EVENT_TYPE_ORDER, type CalendarEventTypeKey };

const ALL_SET = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);

export function normalizeCalendarEventTypeFilterStored(raw: unknown): Set<CalendarEventTypeKey> {
  if (!Array.isArray(raw)) return new Set(ALL_SET);
  if (raw.length === 0) return new Set();
  const next = new Set<CalendarEventTypeKey>();
  for (const x of raw) {
    if (CALENDAR_EVENT_TYPE_ORDER.includes(x as CalendarEventTypeKey)) {
      next.add(x as CalendarEventTypeKey);
    }
  }
  return next;
}
