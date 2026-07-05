export type SignalCacheMode = 'use' | 'bypass';

/**
 * 피드·리스트 API 호출 규칙
 * - 기본(`use`): integrations/signal-api 메모리 캐시. 필터·탭 전환·재진입 시 캐시 hit이면 즉시 표시.
 * - 새로고침(`bypass`): 당겨서 새로고침 등에서만 네트워크 강제.
 */
export function signalCacheMode(refresh?: boolean): SignalCacheMode {
  return refresh ? 'bypass' : 'use';
}
