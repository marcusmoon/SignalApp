import AsyncStorage from '@react-native-async-storage/async-storage';

/** 캘린더·컨콜 실적(earnings) 후보: 메가캡 유니버스 vs 시세 관심종목 */
export type CalendarConcallScope = 'mega' | 'watch';

const KEY = '@signal/calendar_concall_scope_v1';
const LEGACY_MEGA_KEY = '@signal/mega_cap_calendar_scope_v1';
const LEGACY_WATCHLIST_ONLY_KEY = '@signal/concall_watchlist_only_v1';

export async function loadCalendarConcallScope(): Promise<CalendarConcallScope> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw === 'mega' || raw === 'watch') return raw;

    const legacyWatch = await AsyncStorage.getItem(LEGACY_WATCHLIST_ONLY_KEY);
    if (legacyWatch === 'true') {
      await AsyncStorage.setItem(KEY, 'watch');
      return 'watch';
    }

    const legacyMega = await AsyncStorage.getItem(LEGACY_MEGA_KEY);
    if (legacyMega === '1') {
      await AsyncStorage.setItem(KEY, 'mega');
      return 'mega';
    }

    await AsyncStorage.setItem(KEY, 'mega');
    return 'mega';
  } catch {
    return 'mega';
  }
}

export async function saveCalendarConcallScope(scope: CalendarConcallScope): Promise<void> {
  await AsyncStorage.setItem(KEY, scope);
}
