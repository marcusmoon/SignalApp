import type { AppTheme } from '@/constants/theme';

export type HomeAccentSection = 'issues' | 'signal' | 'disclosure';

export const HOME_SECTION_ACCENT_WIDTH = 2;

const SIGNAL_ACCENT_LIGHT = '#7C5CFC';
const SIGNAL_ACCENT_DARK = '#9B7EFF';

export function homeSectionAccentColor(section: HomeAccentSection, theme: AppTheme): string {
  if (section === 'disclosure') return theme.warning;
  if (section === 'signal') {
    return theme.colorScheme === 'dark' ? SIGNAL_ACCENT_DARK : SIGNAL_ACCENT_LIGHT;
  }
  return theme.green;
}
