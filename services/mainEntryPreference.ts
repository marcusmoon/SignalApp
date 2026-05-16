import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainEntryKey = 'home' | 'news' | 'quotes' | 'youtube' | 'more';

/** 설정「첫 화면」세그먼트 순서 — 하단 탭(뉴스·시세·홈·유튜브·더보기)과 동일 */
export const MAIN_ENTRY_DISPLAY_ORDER: MainEntryKey[] = ['news', 'quotes', 'home', 'youtube', 'more'];

const STORAGE_KEY = '@signal/main_entry_v1';
const VALID = new Set<MainEntryKey>(['home', 'news', 'quotes', 'youtube', 'more']);

export async function loadMainEntry(): Promise<MainEntryKey> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v && VALID.has(v as MainEntryKey) ? (v as MainEntryKey) : 'home';
}

export async function saveMainEntry(key: MainEntryKey): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, VALID.has(key) ? key : 'home');
}

export function mainEntryHref(key: MainEntryKey): '/news' | '/quotes' | '/youtube' | '/more' | null {
  if (key === 'news') return '/news';
  if (key === 'quotes') return '/quotes';
  if (key === 'youtube') return '/youtube';
  if (key === 'more') return '/more';
  return null;
}
