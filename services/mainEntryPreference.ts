import AsyncStorage from '@react-native-async-storage/async-storage';

export type MainEntryKey = 'home' | 'news' | 'quotes' | 'more';

const STORAGE_KEY = '@signal/main_entry_v1';
const VALID = new Set<MainEntryKey>(['home', 'news', 'quotes', 'more']);

export async function loadMainEntry(): Promise<MainEntryKey> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v && VALID.has(v as MainEntryKey) ? (v as MainEntryKey) : 'home';
}

export async function saveMainEntry(key: MainEntryKey): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, VALID.has(key) ? key : 'home');
}

export function mainEntryHref(key: MainEntryKey): '/news' | '/quotes' | '/more' | null {
  if (key === 'news') return '/news';
  if (key === 'quotes') return '/quotes';
  if (key === 'more') return '/more';
  return null;
}
