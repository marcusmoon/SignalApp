import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@signal/calendar_scope_v1';

export type CalendarScopeMode = 'meaningful' | 'full';

export async function loadCalendarScopeMode(): Promise<CalendarScopeMode> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw === 'full' ? 'full' : 'meaningful';
  } catch {
    return 'meaningful';
  }
}

export async function saveCalendarScopeMode(mode: CalendarScopeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
