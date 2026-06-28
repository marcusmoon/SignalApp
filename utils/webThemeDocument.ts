import { SIGNAL_DARK, SIGNAL_LIGHT, type ThemeColorScheme } from '@/constants/theme';
import type { ThemeAppearanceMode } from '@/services/themeAppearancePreference';

export const WEB_THEME_APPEARANCE_KEYS = [
  'AsyncStorage:@signal/theme_appearance_mode_v1',
  '@signal/theme_appearance_mode_v1',
] as const;

function parseStoredMode(raw: string | null | undefined): ThemeAppearanceMode | null {
  const mode = String(raw ?? '')
    .trim()
    .replace(/^"|"$/g, '');
  if (mode === 'light' || mode === 'dark' || mode === 'system') return mode;
  return null;
}

/** Read persisted appearance mode from web localStorage (sync, before React hydrates). */
export function readWebThemeAppearanceMode(): ThemeAppearanceMode {
  if (typeof window === 'undefined') return 'system';
  try {
    for (const key of WEB_THEME_APPEARANCE_KEYS) {
      const parsed = parseStoredMode(window.localStorage.getItem(key));
      if (parsed) return parsed;
    }
  } catch {
    // Ignore storage access errors.
  }
  return 'system';
}

export function systemPrefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export function resolveThemeColorScheme(
  appearanceMode: ThemeAppearanceMode,
  prefersDark = systemPrefersDark(),
): ThemeColorScheme {
  if (appearanceMode === 'dark') return 'dark';
  if (appearanceMode === 'light') return 'light';
  return prefersDark ? 'dark' : 'light';
}

export function themeBackgroundForScheme(scheme: ThemeColorScheme): string {
  return scheme === 'dark' ? SIGNAL_DARK.bg : SIGNAL_LIGHT.bg;
}

/** Keep html/body/#root aligned with the active app theme on web. */
export function applyWebDocumentTheme(scheme: ThemeColorScheme, bg: string): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.signalTheme = scheme;
  root.style.colorScheme = scheme;
  root.style.backgroundColor = bg;
  document.body.style.backgroundColor = bg;
  const appRoot = document.getElementById('root');
  if (appRoot) appRoot.style.backgroundColor = bg;
}
