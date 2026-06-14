/** 더보기 탭에서 이동하는 스택 화면 키(순서 저장용). */
export type MoreHubRouteKey = 'youtube' | 'account' | 'settings';

/** 투자 캘린더는 상단 헤더에서 진입 — 더보기 허브에는 두지 않음 */
export const MORE_HUB_ROUTE_ORDER_DEFAULT: MoreHubRouteKey[] = [
  'youtube',
  'account',
  'settings',
];
