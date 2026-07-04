export const COMMUNITY_SOURCE_ALL = 'all' as const;

export const COMMUNITY_SOURCES = ['naver_likeusstock_free', 'save_user_news'] as const;

export type CommunitySourceKey = (typeof COMMUNITY_SOURCES)[number];

export type CommunitySourceFilter = typeof COMMUNITY_SOURCE_ALL | CommunitySourceKey;

export const COMMUNITY_SOURCE_ORDER: CommunitySourceFilter[] = [
  COMMUNITY_SOURCE_ALL,
  ...COMMUNITY_SOURCES,
];

const COMMUNITY_SOURCES_WITH_ORIGINAL_LINK = new Set<CommunitySourceKey>(['naver_likeusstock_free']);

export function communityShowsOriginalLink(source: string): boolean {
  return COMMUNITY_SOURCES_WITH_ORIGINAL_LINK.has(source as CommunitySourceKey);
}
