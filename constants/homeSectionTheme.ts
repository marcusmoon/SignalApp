import type { HomeDigestCategory } from '@/constants/ipadHomeNav';
import type { ThemeColorScheme } from '@/constants/theme';
import type { ViewStyle } from 'react-native';

export type HomeSectionKey = 'issues' | 'signal' | 'disclosure' | 'calendar' | 'watchlist';

export type HomeSectionPalette = {
  accent: string;
  dim: string;
  border: string;
};

export const HOME_SECTION_ACCENT_WIDTH = 4;

const HOME_SECTION_LIGHT: Record<HomeSectionKey, HomeSectionPalette> = {
  issues: { accent: '#3182F6', dim: '#EAF3FF', border: '#D6E9FF' },
  signal: { accent: '#7C5CFC', dim: '#F3EFFF', border: '#E4D9FF' },
  disclosure: { accent: '#F59F00', dim: '#FFF7E6', border: '#FFE4B5' },
  calendar: { accent: '#6B7684', dim: '#F2F4F6', border: '#E5E8EB' },
  watchlist: { accent: '#00A86B', dim: '#E8F8F1', border: '#C8EDDC' },
};

const HOME_SECTION_DARK: Record<HomeSectionKey, HomeSectionPalette> = {
  issues: { accent: '#3182F6', dim: '#112A4D', border: '#1F4E86' },
  signal: { accent: '#9B7EFF', dim: '#2A1F4D', border: '#4A3A8F' },
  disclosure: { accent: '#FFB020', dim: '#33250D', border: '#5C4518' },
  calendar: { accent: '#8B95A1', dim: '#1A1D24', border: '#2A2E3A' },
  watchlist: { accent: '#2ECC87', dim: '#0D2A1F', border: '#1A5C42' },
};

export function homeSectionPalette(key: HomeSectionKey, scheme: ThemeColorScheme): HomeSectionPalette {
  return scheme === 'dark' ? HOME_SECTION_DARK[key] : HOME_SECTION_LIGHT[key];
}

export type HomeCategoryPalette = HomeSectionPalette;

const CATEGORY_LIGHT: Record<HomeDigestCategory, HomeCategoryPalette> = {
  global: { accent: '#3182F6', dim: '#EAF3FF', border: '#D6E9FF' },
  korea: { accent: '#F04452', dim: '#FFF0F1', border: '#FFCCD0' },
  crypto: { accent: '#F59F00', dim: '#FFF7E6', border: '#FFE4B5' },
};

const CATEGORY_DARK: Record<HomeDigestCategory, HomeCategoryPalette> = {
  global: { accent: '#3182F6', dim: '#112A4D', border: '#1F4E86' },
  korea: { accent: '#FF6B7A', dim: '#34181D', border: '#5C2830' },
  crypto: { accent: '#FFB020', dim: '#33250D', border: '#5C4518' },
};

export function homeCategoryPalette(category: HomeDigestCategory, scheme: ThemeColorScheme): HomeCategoryPalette {
  return scheme === 'dark' ? CATEGORY_DARK[category] : CATEGORY_LIGHT[category];
}

export function homeSignalSessionPalette(market: 'us' | 'kr', scheme: ThemeColorScheme): HomeCategoryPalette {
  if (market === 'us') {
    return scheme === 'dark'
      ? { accent: '#9B7EFF', dim: '#2A1F4D', border: '#4A3A8F' }
      : { accent: '#7C5CFC', dim: '#F3EFFF', border: '#E4D9FF' };
  }
  return homeSectionPalette('issues', scheme);
}

export function homeSectionCardStyle(palette: HomeSectionPalette): ViewStyle {
  return {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.dim,
  };
}

export function homeSectionAccentLineStyle(palette: HomeSectionPalette): ViewStyle {
  return {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: HOME_SECTION_ACCENT_WIDTH,
    backgroundColor: palette.accent,
  };
}
