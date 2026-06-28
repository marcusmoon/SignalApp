import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ThemeAppearanceMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@signal/theme_appearance_mode_v1';
export const WEB_THEME_APPEARANCE_MIRROR_KEY = 'signal_theme_appearance_mode';

const VALID = new Set<ThemeAppearanceMode>(['system', 'light', 'dark']);

function normalizeMode(v: string | null | undefined): ThemeAppearanceMode | null {
  return v && VALID.has(v as ThemeAppearanceMode) ? (v as ThemeAppearanceMode) : null;
}

function readWebMirror(): ThemeAppearanceMode | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  try {
    return normalizeMode(window.localStorage.getItem(WEB_THEME_APPEARANCE_MIRROR_KEY));
  } catch {
    return null;
  }
}

function writeWebMirror(mode: ThemeAppearanceMode): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_THEME_APPEARANCE_MIRROR_KEY, mode);
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

export async function loadThemeAppearanceMode(): Promise<ThemeAppearanceMode> {
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return normalizeMode(v) ?? readWebMirror() ?? 'system';
}

export async function saveThemeAppearanceMode(mode: ThemeAppearanceMode): Promise<void> {
  const next = VALID.has(mode) ? mode : 'system';
  await AsyncStorage.setItem(STORAGE_KEY, next);
  writeWebMirror(next);
}
