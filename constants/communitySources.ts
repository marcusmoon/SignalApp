import type { AppTheme } from '@/constants/theme';

export const COMMUNITY_SOURCE_ALL = 'all' as const;

export const COMMUNITY_SOURCES = ['save_user_news', 'naver_likeusstock_free'] as const;

export type CommunitySourceKey = (typeof COMMUNITY_SOURCES)[number];

export type CommunitySourceFilter = typeof COMMUNITY_SOURCE_ALL | CommunitySourceKey;

export const COMMUNITY_SOURCE_ORDER: CommunitySourceFilter[] = [
  COMMUNITY_SOURCE_ALL,
  ...COMMUNITY_SOURCES,
];

const COMMUNITY_SOURCES_WITH_ORIGINAL_LINK = new Set<CommunitySourceKey>([
  'save_user_news',
  'naver_likeusstock_free',
]);

export function communityShowsOriginalLink(source: string): boolean {
  return COMMUNITY_SOURCES_WITH_ORIGINAL_LINK.has(source as CommunitySourceKey);
}

export type CommunitySourceAccent = {
  accent: string;
  dim: string;
  border: string;
};

/** 소스별 리스트·상세 accent (미주미=블루, 세이브=오렌지) */
export function communitySourceAccent(source: string, theme: AppTheme): CommunitySourceAccent {
  if (source === 'save_user_news') {
    return {
      accent: theme.accentOrange,
      dim: theme.warningDim,
      border: theme.accentOrange,
    };
  }
  return {
    accent: theme.green,
    dim: theme.greenDim,
    border: theme.greenBorder,
  };
}
