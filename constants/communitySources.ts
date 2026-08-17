import type { AppTheme } from '@/constants/theme';
import type { SourceAccent } from '@/constants/sourceAccent';
import { accentAlpha } from '@/constants/sourceAccent';
import { externalSourceIconUrlForCommunityKey } from '@/constants/sourceIconUrls';

export const COMMUNITY_SOURCE_ALL = 'all' as const;

export const COMMUNITY_SOURCES = [
  'save_user_news',
  'naver_likeusstock_free',
  'naver_yamizal_free',
  'motley_fool_investing',
] as const;

export type CommunitySourceKey = (typeof COMMUNITY_SOURCES)[number];

export type CommunitySourceFilter = typeof COMMUNITY_SOURCE_ALL | CommunitySourceKey;

export const COMMUNITY_SOURCE_ORDER: CommunitySourceFilter[] = [
  COMMUNITY_SOURCE_ALL,
  ...COMMUNITY_SOURCES,
];

const COMMUNITY_SOURCES_WITH_ORIGINAL_LINK = new Set<CommunitySourceKey>([
  'save_user_news',
  'naver_likeusstock_free',
  'naver_yamizal_free',
  'motley_fool_investing',
]);

export function communityShowsOriginalLink(source: string): boolean {
  return COMMUNITY_SOURCES_WITH_ORIGINAL_LINK.has(source as CommunitySourceKey);
}

export type CommunitySourceAccent = SourceAccent;

/** 소스별 리스트·상세 accent (미주미·미치다=네이버, 모틀리=블루, 세이브=오렌지) */
export function communitySourceAccent(source: string, theme: AppTheme): CommunitySourceAccent {
  const iconUrl = externalSourceIconUrlForCommunityKey(source);
  if (source === 'save_user_news') {
    return {
      accent: theme.accentOrange,
      dim: theme.warningDim,
      border: accentAlpha(theme.accentOrange, theme.colorScheme === 'dark' ? 0.55 : 0.35),
      glyph: 'S',
      iconUrl,
    };
  }
  if (source === 'motley_fool_investing') {
    return {
      accent: theme.accentBlue,
      dim: accentAlpha(theme.accentBlue, theme.colorScheme === 'dark' ? 0.22 : 0.12),
      border: accentAlpha(theme.accentBlue, theme.colorScheme === 'dark' ? 0.55 : 0.35),
      glyph: 'F',
      iconUrl,
    };
  }
  return {
    accent: theme.green,
    dim: theme.greenDim,
    border: theme.greenBorder,
    glyph: 'N',
    iconUrl,
  };
}
