import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CALENDAR_EVENT_TYPE_ORDER,
  normalizeCalendarEventTypeFilterStored,
  type CalendarEventTypeKey,
} from '@/domain/calendar/eventTypeFilter';

const STORAGE_KEY = '@signal/calendar_event_type_filter_v1';

export {
  CALENDAR_EVENT_TYPE_ORDER,
  type CalendarEventTypeKey,
} from '@/domain/calendar/eventTypeFilter';

export async function loadCalendarEventTypeFilter(): Promise<Set<CalendarEventTypeKey>> {
  try {
    const s = await AsyncStorage.getItem(STORAGE_KEY);
    if (!s) return new Set(CALENDAR_EVENT_TYPE_ORDER);
    return normalizeCalendarEventTypeFilterStored(JSON.parse(s) as unknown);
  } catch {
    return new Set(CALENDAR_EVENT_TYPE_ORDER);
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
