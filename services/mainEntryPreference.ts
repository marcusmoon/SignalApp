import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainEntryKey = 'home' | 'news' | 'quotes' | 'more';

/** 설정「첫 화면」세그먼트 순서 — 홈 우선 체크 흐름 기준 */
export const MAIN_ENTRY_DISPLAY_ORDER: MainEntryKey[] = ['home', 'news', 'quotes', 'more'];

const STORAGE_KEY = '@signal/main_entry_v1';
const VALID = new Set<MainEntryKey>(['home', 'news', 'quotes', 'more']);

let cachedMainEntry: MainEntryKey | null = null;

export async function loadMainEntry(): Promise<MainEntryKey> {
  if (cachedMainEntry) return cachedMainEntry;
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  const entry = v && VALID.has(v as MainEntryKey) ? (v as MainEntryKey) : 'home';
  cachedMainEntry = entry;
  return entry;
}

export async function saveMainEntry(key: MainEntryKey): Promise<void> {
  const entry = VALID.has(key) ? key : 'home';
  cachedMainEntry = entry;
  await AsyncStorage.setItem(STORAGE_KEY, entry);
}

export function mainEntryHref(key: MainEntryKey): '/news' | '/quotes' | '/more' | null {
  if (key === 'news') return '/news';
  if (key === 'quotes') return '/quotes';
  if (key === 'more') return '/more';
  return null;
}
