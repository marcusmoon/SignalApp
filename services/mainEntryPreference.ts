import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainEntryKey = 'home' | 'news' | 'signal' | 'quotes' | 'more';

/** 설정「첫 화면」세그먼트 순서 — 하단 메뉴 순서와 동일 */
export const MAIN_ENTRY_DISPLAY_ORDER: MainEntryKey[] = ['home', 'news', 'signal', 'quotes', 'more'];

const STORAGE_KEY = '@signal/main_entry_v1';
const VALID = new Set<MainEntryKey>(['home', 'news', 'signal', 'quotes', 'more']);

let cachedMainEntry: MainEntryKey | null = null;

function normalizeStoredEntry(raw: string | null): MainEntryKey {
  if (raw === 'home' || raw === 'briefing') return 'home';
  if (raw === 'disclosures') return 'more';
  if (raw && VALID.has(raw as MainEntryKey)) return raw as MainEntryKey;
  return 'home';
}

export async function loadMainEntry(): Promise<MainEntryKey> {
  if (cachedMainEntry) return cachedMainEntry;
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  const entry = normalizeStoredEntry(v);
  cachedMainEntry = entry;
  return entry;
}

export async function saveMainEntry(key: MainEntryKey): Promise<void> {
  const entry = VALID.has(key) ? key : 'home';
  cachedMainEntry = entry;
  await AsyncStorage.setItem(STORAGE_KEY, entry);
}

export function mainEntryHref(key: MainEntryKey): '/home' | '/news' | '/signal' | '/quotes' | '/more' | null {
  if (key === 'home') return '/home';
  if (key === 'news') return '/news';
  if (key === 'signal') return '/signal';
  if (key === 'quotes') return '/quotes';
  if (key === 'more') return '/more';
  return null;
}
