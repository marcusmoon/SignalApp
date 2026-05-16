import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeAppearanceMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@signal/theme_appearance_mode_v1';

const VALID = new Set<ThemeAppearanceMode>(['system', 'light', 'dark']);

export async function loadThemeAppearanceMode(): Promise<ThemeAppearanceMode> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return v && VALID.has(v as ThemeAppearanceMode) ? (v as ThemeAppearanceMode) : 'system';
}

export async function saveThemeAppearanceMode(mode: ThemeAppearanceMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, VALID.has(mode) ? mode : 'system');
}
