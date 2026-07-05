import { SIGNAL_DARK, SIGNAL_LIGHT, type AppTheme, type ThemeColorScheme } from '@/constants/theme';
import {
  readThemeAppearanceModeSync,
  WEB_THEME_APPEARANCE_KEYS,
  WEB_THEME_APPEARANCE_MIRROR_KEY,
  WEB_THEME_EFFECTIVE_SCHEME_KEY,
  type ThemeAppearanceMode,
} from '@/services/themeAppearancePreference';

export { WEB_THEME_APPEARANCE_KEYS, WEB_THEME_APPEARANCE_MIRROR_KEY, WEB_THEME_EFFECTIVE_SCHEME_KEY };

/** @deprecated Prefer readThemeAppearanceModeSync from themeAppearancePreference. */
export function readWebThemeAppearanceMode(): ThemeAppearanceMode {
  return readThemeAppearanceModeSync();
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

export function themeTokensForScheme(scheme: ThemeColorScheme): AppTheme {
  return scheme === 'dark' ? { ...SIGNAL_DARK } : { ...SIGNAL_LIGHT };
}

export function applyWebThemeCssVariables(root: HTMLElement, theme: Pick<AppTheme, 'bg' | 'bgElevated' | 'card' | 'border' | 'text' | 'textMuted' | 'textDim' | 'green' | 'greenDim' | 'greenBorder'>): void {
  root.style.setProperty('--signal-bg', theme.bg);
  root.style.setProperty('--signal-bg-elevated', theme.bgElevated);
  root.style.setProperty('--signal-card', theme.card);
  root.style.setProperty('--signal-border', theme.border);
  root.style.setProperty('--signal-text', theme.text);
  root.style.setProperty('--signal-text-muted', theme.textMuted);
  root.style.setProperty('--signal-text-dim', theme.textDim);
  root.style.setProperty('--signal-green', theme.green);
  root.style.setProperty('--signal-green-dim', theme.greenDim);
  root.style.setProperty('--signal-green-border', theme.greenBorder);
}

/** Keep html/body/#root aligned with the active app theme on web. */
export function applyWebDocumentTheme(scheme: ThemeColorScheme, bg: string, activeTheme?: AppTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const theme = activeTheme ?? themeTokensForScheme(scheme);
  root.dataset.signalTheme = scheme;
  root.style.colorScheme = scheme;
  root.style.backgroundColor = bg;
  applyWebThemeCssVariables(root, theme);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(WEB_THEME_EFFECTIVE_SCHEME_KEY, scheme);
    } catch {
      // ignore quota / private mode
    }
  }
  document.body.style.backgroundColor = bg;
  const appRoot = document.getElementById('root');
  if (appRoot) {
    appRoot.style.backgroundColor = bg;
    const appShell = appRoot.firstElementChild;
    if (appShell instanceof HTMLElement) {
      appShell.style.backgroundColor = bg;
      if (appShell.firstElementChild instanceof HTMLElement) {
        appShell.firstElementChild.style.backgroundColor = bg;
      }
    }
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', bg);
}
