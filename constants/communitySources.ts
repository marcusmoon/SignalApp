import type { AppTheme } from '@/constants/theme';
import type { SourceAccent } from '@/constants/sourceAccent';
import { accentAlpha } from '@/constants/sourceAccent';
import { externalSourceIconUrlForCommunityKey } from '@/constants/sourceIconUrls';

export const COMMUNITY_SOURCE_ALL = 'all' as const;

export const COMMUNITY_SOURCES = [
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

const COMMUNITY_SOURCES_WITH_ORIGINAL_LINK = new Set<CommunitySourceKey>(COMMUNITY_SOURCES);

export function communityShowsOriginalLink(source: string): boolean {
  return COMMUNITY_SOURCES_WITH_ORIGINAL_LINK.has(source as CommunitySourceKey);
}

export type CommunitySourceAccent = SourceAccent;

export function isCommunitySourceKey(source: string): source is CommunitySourceKey {
  return (COMMUNITY_SOURCES as readonly string[]).includes(source);
}

/** 소스별 리스트·상세 accent (미주미·미치다=네이버, 모틀리=블루) */
export function communitySourceAccent(source: string, theme: AppTheme): CommunitySourceAccent {
  const iconUrl = externalSourceIconUrlForCommunityKey(source);
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
