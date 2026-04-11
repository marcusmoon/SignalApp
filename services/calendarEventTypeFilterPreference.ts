import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CalendarEvent } from '@/types/signal';

export type CalendarEventTypeKey = CalendarEvent['type'];

const STORAGE_KEY = '@signal/calendar_event_type_filter_v1';

export const CALENDAR_EVENT_TYPE_ORDER: CalendarEventTypeKey[] = ['earnings', 'macro', 'fed', 'fomc'];

const ALL_SET = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);

function normalizeStored(raw: unknown): Set<CalendarEventTypeKey> {
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

export async function loadCalendarEventTypeFilter(): Promise<Set<CalendarEventTypeKey>> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEY);
    if (!s) return new Set(ALL_SET);
    return normalizeStored(JSON.parse(s) as unknown);
  } catch {
    return new Set(ALL_SET);
  }
}

export async function saveCalendarEventTypeFilter(enabled: Set<CalendarEventTypeKey>): Promise<void> {
  const arr = CALENDAR_EVENT_TYPE_ORDER.filter((k) => enabled.has(k));
  if (arr.length === 0) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...CALENDAR_EVENT_TYPE_ORDER]));
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}
