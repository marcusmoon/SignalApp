import type { AppTheme } from '@/constants/theme';

export type HomeAccentSection = 'issues' | 'signal' | 'disclosure';

/** 홈·뉴스·시그널 등 콘텐츠 카드 왼쪽 강조선 공통 두께 */
export const CONTENT_ACCENT_LINE_WIDTH = 2;

export const HOME_SECTION_ACCENT_WIDTH = CONTENT_ACCENT_LINE_WIDTH;

const SIGNAL_ACCENT_LIGHT = '#7C5CFC';
const SIGNAL_ACCENT_DARK = '#9B7EFF';

export function homeSectionAccentColor(section: HomeAccentSection, theme: AppTheme): string {
  if (section === 'disclosure') return theme.warning;
  if (section === 'signal') {
    return theme.colorScheme === 'dark' ? SIGNAL_ACCENT_DARK : SIGNAL_ACCENT_LIGHT;
  }
  return theme.green;
}
