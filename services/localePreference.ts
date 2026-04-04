import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '@/locales/messages';

export const LOCALE_STORAGE_KEY = '@signal/locale_v1';

export async function loadLocale(): Promise<AppLocale> {
  const v = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  if (v === 'ko' || v === 'en' || v === 'ja') return v;
  return 'ko';
}

export async function saveLocale(locale: AppLocale): Promise<void> {
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
