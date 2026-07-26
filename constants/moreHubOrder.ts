/** 더보기 탭에서 이동하는 스택 화면 키(순서 저장용). */
export type MoreHubRouteKey =
  | 'board'
  | 'disclosures'
  | 'etfBriefing'
  | 'screener'
  | 'gameCenter'
  | 'account';

/** 투자 캘린더·홈·설정은 메인 탭/내정보 — 더보기 허브에는 두지 않음 */
export const MORE_HUB_ROUTE_ORDER_DEFAULT: MoreHubRouteKey[] = [
  'account',
  'disclosures',
  'etfBriefing',
  'screener',
  'board',
  'gameCenter',
];
