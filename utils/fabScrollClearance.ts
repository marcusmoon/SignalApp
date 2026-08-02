/**
 * FAB가 떠 있을 때 스크롤 하단에 더하는 작은 쿠션.
 * FAB 높이 전체를 비우지 않는다 — 마지막 행은 탭바 근처까지 오고 FAB는 그 위를 오버레이.
 */

export const FAB_OVERLAY_SCROLL_CUSHION = 8;

export function fabOverlayScrollCushion(fabCount: number): number {
  return Math.max(0, Math.floor(fabCount)) > 0 ? FAB_OVERLAY_SCROLL_CUSHION : 0;
}

/**
 * @deprecated Use `fabOverlayScrollCushion` — full FAB overhang made bottoms sit above the FAB.
 */
export function fabScrollClearanceAboveBase(
  fabCount: number,
  _base: number,
  _opts?: { fabSize?: number; fabGap?: number; offset?: number },
): number {
  return fabOverlayScrollCushion(fabCount);
}
