import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppLocale } from '@/locales/messages';

export const LOCALE_STORAGE_KEY = '@signal/locale_v1';

let cachedLocale: AppLocale | null = null;

export async function loadLocale(): Promise<AppLocale> {
  if (cachedLocale) return cachedLocale;
  const v = await AsyncStorage.getItem(LOCALE_STORAGE_KEY);
  if (v === 'ko' || v === 'en' || v === 'ja') {
    cachedLocale = v;
    return v;
  }
  cachedLocale = 'ko';
  return 'ko';
}

export async function saveLocale(locale: AppLocale): Promise<void> {
  cachedLocale = locale;
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
}
