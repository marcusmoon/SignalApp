import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import type { ThemeColorScheme } from '@/constants/theme';

export type ThemeAppearanceMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = '@signal/theme_appearance_mode_v1';
export const WEB_THEME_APPEARANCE_MIRROR_KEY = 'signal_theme_appearance_mode';
/** Resolved palette written on every save/apply for head-script reads. */
export const WEB_THEME_EFFECTIVE_SCHEME_KEY = 'signal_theme_effective_scheme';
export const THEME_APPEARANCE_CHANGED_EVENT = 'signal-theme-appearance-changed';
/** Older builds incorrectly read this prefixed key; keep only as legacy fallback. */
export const WEB_THEME_LEGACY_ASYNC_STORAGE_KEY = `AsyncStorage:${STORAGE_KEY}`;

/** Mirror is written synchronously on every save; prefer it over stale primary keys. */
export const WEB_THEME_APPEARANCE_KEYS = [
  WEB_THEME_APPEARANCE_MIRROR_KEY,
  STORAGE_KEY,
  WEB_THEME_LEGACY_ASYNC_STORAGE_KEY,
] as const;

const VALID = new Set<ThemeAppearanceMode>(['system', 'light', 'dark']);

function normalizeMode(v: string | null | undefined): ThemeAppearanceMode | null {
  let raw = String(v ?? '').trim();
  if (raw.startsWith('{') || raw.startsWith('[') || raw.startsWith('"')) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed === 'string') raw = parsed.trim();
    } catch {
      // keep raw string
    }
  }
  raw = raw.replace(/^"|"$/g, '');
  return raw && VALID.has(raw as ThemeAppearanceMode) ? (raw as ThemeAppearanceMode) : null;
}

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

function resolveEffectiveScheme(
  appearanceMode: ThemeAppearanceMode,
  prefersDark = systemPrefersDark(),
): ThemeColorScheme {
  if (appearanceMode === 'dark') return 'dark';
  if (appearanceMode === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

function normalizeEffectiveScheme(v: string | null | undefined): ThemeColorScheme | null {
  const raw = String(v ?? '')
    .trim()
    .replace(/^"|"$/g, '');
  return raw === 'dark' || raw === 'light' ? raw : null;
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

function writeWebEffectiveScheme(scheme: ThemeColorScheme): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WEB_THEME_EFFECTIVE_SCHEME_KEY, scheme);
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

function writeWebPrimary(mode: ThemeAppearanceMode): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // localStorage may be unavailable in private contexts.
  }
}

export function notifyThemeAppearanceChanged(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  window.dispatchEvent(new Event(THEME_APPEARANCE_CHANGED_EVENT));
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
  const mirror = stored[WEB_THEME_APPEARANCE_MIRROR_KEY];
  const primary = stored[STORAGE_KEY];
  if (mirror && primary && mirror !== primary) {
    // Mirror is updated synchronously on every save; primary can lag from older builds.
    return mirror;
  }

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

/** Sync read of the resolved palette for web head script and hydration guards. */
export function readEffectiveColorSchemeSync(prefersDark = systemPrefersDark()): ThemeColorScheme {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const stored = normalizeEffectiveScheme(window.localStorage.getItem(WEB_THEME_EFFECTIVE_SCHEME_KEY));
      if (stored) return stored;
    } catch {
      // ignore
    }
  }
  return resolveEffectiveScheme(readThemeAppearanceModeSync(), prefersDark);
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
  const effectiveScheme = resolveEffectiveScheme(next, systemPrefersDark());
  writeWebPrimary(next);
  writeWebMirror(next);
  writeWebEffectiveScheme(effectiveScheme);
  removeWebLocalStorage(WEB_THEME_LEGACY_ASYNC_STORAGE_KEY);
  await AsyncStorage.setItem(STORAGE_KEY, next);
  notifyThemeAppearanceChanged();
}
