export type TabScrollLoadingGateArgs = {
  itemsLength: number;
  loading: boolean;
  /**
   * true: 저장소·권한 등 탭 본문 fetch 전에 끝나야 하는 부트스트랩이 남음 (예: 유튜브 채널 선택 로드).
   * 목록이 비어 있을 때만 전체 화면 로딩에 반영한다.
   */
  awaitingBootstrap?: boolean;
};

/**
 * 스크롤 본문을 `SignalLoadingIndicator` 등으로 전체 덮을지.
 *
 * 규칙: **목록 길이가 1 이상이면 항상 false** — 탭 전환·상태 경합으로도 이미 불러온 카드는 가리지 않음.
 * 빈 목록일 때만 `awaitingBootstrap` 또는 `loading`으로 로딩 UI를 쓴다.
 */
export function shouldShowTabScrollFullScreenLoading(a: TabScrollLoadingGateArgs): boolean {
  if (a.itemsLength > 0) return false;
  return Boolean(a.awaitingBootstrap) || a.loading;
}
