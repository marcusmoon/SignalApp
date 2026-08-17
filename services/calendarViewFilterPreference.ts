import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isCalendarViewFilterKey,
  type CalendarViewFilterKey,
} from '@/domain/calendar/calendarViewFilter';
import { CALENDAR_EVENT_TYPE_ORDER } from '@/domain/calendar';
import { loadCalendarEventTypeFilter } from '@/services/calendarEventTypeFilterPreference';
import { loadCalendarScopeMode } from '@/services/calendarScopePreference';

const STORAGE_KEY = '@signal/calendar_view_filter_v1';

export async function loadCalendarViewFilter(): Promise<CalendarViewFilterKey> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (isCalendarViewFilterKey(raw)) return raw;
  } catch {
    /* migrate below */
  }

  const [types, scope] = await Promise.all([
    loadCalendarEventTypeFilter(),
    loadCalendarScopeMode(),
  ]);
  if (types.size === 1) {
    const type = CALENDAR_EVENT_TYPE_ORDER.find((key) => types.has(key));
    if (type === 'fed' || type === 'fomc') return 'policy';
    if (type === 'macro' || type === 'earnings' || type === 'holiday') return type;
  }
  return scope === 'full' ? 'full' : 'meaningful';
}

export async function saveCalendarViewFilter(filter: CalendarViewFilterKey): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, filter);
  } catch {
    /* ignore */
  }
}
