import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export type ThemeAppearanceMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@signal/theme_appearance_mode_v1';
export const WEB_THEME_APPEARANCE_MIRROR_KEY = 'signal_theme_appearance_mode';
/** Older builds incorrectly read this prefixed key; keep only as legacy fallback. */
export const WEB_THEME_LEGACY_ASYNC_STORAGE_KEY = `AsyncStorage:${STORAGE_KEY}`;

/** Web sync readers should use the same key priority everywhere. */
export const WEB_THEME_APPEARANCE_KEYS = [
  STORAGE_KEY,
  WEB_THEME_APPEARANCE_MIRROR_KEY,
  WEB_THEME_LEGACY_ASYNC_STORAGE_KEY,
] as const;

const VALID = new Set<ThemeAppearanceMode>(['system', 'light', 'dark']);

function normalizeMode(v: string | null | undefined): ThemeAppearanceMode | null {
  const raw = String(v ?? '')
    .trim()
    .replace(/^"|"$/g, '');
  return raw && VALID.has(raw as ThemeAppearanceMode) ? (raw as ThemeAppearanceMode) : null;
}

function readWebLocalStorage(key: string): ThemeAppearanceMode | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeMode(window.localStorage.getItem(key));
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

function removeWebLocalStorage(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function readWebStoredModes(): Partial<Record<(typeof WEB_THEME_APPEARANCE_KEYS)[number], ThemeAppearanceMode>> {
  const out: Partial<Record<(typeof WEB_THEME_APPEARANCE_KEYS)[number], ThemeAppearanceMode>> = {};
  if (typeof window === 'undefined') return out;
  for (const key of WEB_THEME_APPEARANCE_KEYS) {
    const parsed = readWebLocalStorage(key);
    if (parsed) out[key] = parsed;
  }
  return out;
}

function pickCanonicalWebMode(
  stored: Partial<Record<(typeof WEB_THEME_APPEARANCE_KEYS)[number], ThemeAppearanceMode>>,
): ThemeAppearanceMode {
  for (const key of WEB_THEME_APPEARANCE_KEYS) {
    const mode = stored[key];
    if (mode) return mode;
  }
  return 'system';
}

function webStorageNeedsReconcile(
  stored: Partial<Record<(typeof WEB_THEME_APPEARANCE_KEYS)[number], ThemeAppearanceMode>>,
  canonical: ThemeAppearanceMode,
): boolean {
  const values = Object.values(stored);
  if (values.length === 0) return false;
  return values.some((mode) => mode !== canonical);
}

function cleanupLegacyWebThemeKeys(canonical: ThemeAppearanceMode, stored: Partial<Record<string, ThemeAppearanceMode>>): void {
  if (typeof window === 'undefined') return;
  const legacy = stored[WEB_THEME_LEGACY_ASYNC_STORAGE_KEY];
  if (legacy && legacy !== canonical) {
    removeWebLocalStorage(WEB_THEME_LEGACY_ASYNC_STORAGE_KEY);
  }
}

/** Sync read for web pre-hydration paths (+html script, provider init, layout bootstrap). */
export function readThemeAppearanceModeSync(): ThemeAppearanceMode {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'system';
  return pickCanonicalWebMode(readWebStoredModes());
}

export async function loadThemeAppearanceMode(): Promise<ThemeAppearanceMode> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const stored = readWebStoredModes();
    const mode = pickCanonicalWebMode(stored);
    cleanupLegacyWebThemeKeys(mode, stored);
    if (webStorageNeedsReconcile(stored, mode)) {
      await saveThemeAppearanceMode(mode);
    }
    return mode;
  }
  const v = await AsyncStorage.getItem(STORAGE_KEY);
  return normalizeMode(v) ?? 'system';
}

export async function saveThemeAppearanceMode(mode: ThemeAppearanceMode): Promise<void> {
  const next = VALID.has(mode) ? mode : 'system';
  await AsyncStorage.setItem(STORAGE_KEY, next);
  writeWebMirror(next);
  removeWebLocalStorage(WEB_THEME_LEGACY_ASYNC_STORAGE_KEY);
}
