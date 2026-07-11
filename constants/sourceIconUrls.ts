/**
 * 앱에서 네트워크로 불러오는 출처·커뮤니티 외부 아이콘 URL.
 * Google 파비콘 품질이 나쁘거나 잘못 매칭되는 경우만 여기에 고정 URL을 둔다.
 */

/** Google 파비콘 API — 도메인별 기본 fallback */
export const GOOGLE_FAVICON_ICON_SIZE = 64;

export function googleFaviconIconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${GOOGLE_FAVICON_ICON_SIZE}`;
}

/** Financial Juice 공식 앱/모바일 마크 — Google 파비콘 오매칭 회피 */
export const FINANCIAL_JUICE_ICON_URL =
  'https://www.financialjuice.com/assets/comp-images/comp_0.png';

/** 세이브티커 공식 로고 — https://www.saveticker.com */
export const SAVE_TICKER_ICON_URL = 'https://www.saveticker.com/assets/images/Logo.webp';

/** 네이버 카페 공식 파비콘 — https://cafe.naver.com (미주미) */
export const NAVER_CAFE_ICON_URL = 'https://ca-fe.pstatic.net/web-section/favicon.ico';

/** 호스트(도메인) → 고정 아이콘 URL. 키는 소문자·www 없음 기준. */
export const EXTERNAL_SOURCE_ICON_BY_DOMAIN: Readonly<Record<string, string>> = {
  'financialjuice.com': FINANCIAL_JUICE_ICON_URL,
};

/** 커뮤니티 소스 키 → 고정 아이콘 URL */
export const EXTERNAL_SOURCE_ICON_BY_COMMUNITY_KEY: Readonly<Record<string, string>> = {
  save_user_news: SAVE_TICKER_ICON_URL,
  naver_likeusstock_free: NAVER_CAFE_ICON_URL,
};

function bareHostname(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '');
}

/** 도메인에 등록된 고정 외부 아이콘 URL (없으면 null) */
export function externalSourceIconUrlForDomain(domain: string): string | null {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) return null;
  const bare = bareHostname(normalized);
  return EXTERNAL_SOURCE_ICON_BY_DOMAIN[bare] ?? EXTERNAL_SOURCE_ICON_BY_DOMAIN[normalized] ?? null;
}

/** 커뮤니티 소스 키에 등록된 고정 외부 아이콘 URL (없으면 null) */
export function externalSourceIconUrlForCommunityKey(sourceKey: string): string | null {
  const key = sourceKey.trim();
  if (!key) return null;
  return EXTERNAL_SOURCE_ICON_BY_COMMUNITY_KEY[key] ?? null;
}
