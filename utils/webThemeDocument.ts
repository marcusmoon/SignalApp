import { SIGNAL_DARK, SIGNAL_LIGHT, type AppTheme, type ThemeColorScheme } from '@/constants/theme';
import { themeBackgroundPatternCssValue } from '@/constants/themeBackgroundPattern';
import {
  WEB_THEME_APPEARANCE_KEYS,
  WEB_THEME_EFFECTIVE_SCHEME_KEY,
} from '@/services/themeAppearancePreference';

export { WEB_THEME_APPEARANCE_KEYS, WEB_THEME_EFFECTIVE_SCHEME_KEY };

export function themeBackgroundForScheme(scheme: ThemeColorScheme): string {
  return scheme === 'dark' ? SIGNAL_DARK.bg : SIGNAL_LIGHT.bg;
}

export function themeTokensForScheme(scheme: ThemeColorScheme): AppTheme {
  return scheme === 'dark' ? { ...SIGNAL_DARK } : { ...SIGNAL_LIGHT };
}

export function applyWebThemeCssVariables(root: HTMLElement, theme: Pick<AppTheme, 'bg' | 'bgElevated' | 'card' | 'border' | 'text' | 'textMuted' | 'textDim' | 'green' | 'greenDim' | 'greenBorder'>, scheme: ThemeColorScheme): void {
  root.style.setProperty('--signal-bg', theme.bg);
  root.style.setProperty('--signal-bg-pattern', themeBackgroundPatternCssValue(scheme));
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
  applyWebThemeCssVariables(root, theme, scheme);
  document.body.style.backgroundColor = 'transparent';
  const appRoot = document.getElementById('root');
  if (appRoot) {
    appRoot.style.backgroundColor = 'transparent';
    const appShell = appRoot.firstElementChild;
    if (appShell instanceof HTMLElement) {
      appShell.style.backgroundColor = 'transparent';
      if (appShell.firstElementChild instanceof HTMLElement) {
        appShell.firstElementChild.style.backgroundColor = 'transparent';
      }
    }
  }

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) themeColorMeta.setAttribute('content', bg);
}
