import { tabBarBottomInset } from '@/constants/tabBar';

/**
 * 화면 레이아웃 공통 여백 — iPhone / iPad / 웹.
 * 상세 규칙: docs/SCREEN-LAYOUT.md
 */

/** SignalHeader 아래 → 첫 고정 UI(세그먼트·날짜 바)까지 */
export const SCREEN_HEADER_CONTENT_GAP = 12;

/** 고정 헤더 블록(topFixed) 내부 */
export const SCREEN_FIXED_HEADER_PADDING_TOP = SCREEN_HEADER_CONTENT_GAP;
export const SCREEN_FIXED_HEADER_PADDING_BOTTOM = 16;
export const SCREEN_FIXED_HEADER_PADDING_HORIZONTAL = 16;

/** 다이제스트 슬롯 하단 — 리스트와의 간격(고정 스택 마지막) */
export const SCREEN_FIXED_DIGEST_PADDING_BOTTOM = 0;

/** 다이제스트 고정 스트립 바로 아래 스크롤 리스트 상단 (세그먼트↔다이제스트 gap과 동일) */
export const SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP = 12;

/** 고정 헤더 아래 스크롤 리스트 상단 */
export const SCREEN_LIST_CONTENT_PADDING_TOP = 12;

/** iPad·넓은 웹 2-pane 본문 컬럼 상단 */
export const SCREEN_WIDE_CONTENT_PADDING_TOP = 16;

/** FlatList ListHeaderComponent 블록 */
export const SCREEN_LIST_HEADER_PADDING_TOP = 12;
export const SCREEN_LIST_HEADER_PADDING_BOTTOM = 8;

/** 사이드바 서브탭 아래 */
export const SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM = 16;

/** iPad·웹 사이드바 임베디드 스택(뉴스 이슈·공시 흐름 등) */
export const SCREEN_EMBEDDED_WIDE_PADDING_TOP = 18;
export const SCREEN_EMBEDDED_WIDE_PADDING_HORIZONTAL = 20;

/** 하단 탭 화면 스크롤 하단 기본값(탭바·FAB 위) */
export const SCREEN_TAB_SCROLL_BOTTOM_BASE = 24;

/** 스택 화면 스크롤 하단 기본값 */
export const SCREEN_STACK_SCROLL_BOTTOM_BASE = 28;

/** iPad·넓은 웹(하단 탭 없음) 스크롤 하단 */
export const SCREEN_WIDE_SCROLL_BOTTOM_BASE = 32;

/** FAB를 탭바 위에 띄울 때 추가 lift */
export const SCREEN_FAB_ABOVE_TAB_OFFSET = 8;

/** 뉴스 제목 번역 FAB — 탭바 캡슐과 FAB 사이 간격 (0이면 붙어 보임) */
export const SCREEN_NEWS_TITLE_FAB_ABOVE_TAB_OFFSET = 12;

export function tabScreenScrollBottomPadding(
  tabBarHeight: number,
  safeAreaBottom: number,
  base = SCREEN_TAB_SCROLL_BOTTOM_BASE,
): number {
  return base + tabBarHeight + tabBarBottomInset(safeAreaBottom);
}

export function stackScreenScrollBottomPadding(
  safeAreaBottom: number,
  base = SCREEN_STACK_SCROLL_BOTTOM_BASE,
): number {
  return base + safeAreaBottom;
}

export function fabStackBottom(
  tabBarHeight: number,
  safeAreaBottom: number,
  offset = SCREEN_FAB_ABOVE_TAB_OFFSET,
): number {
  return tabBarHeight + tabBarBottomInset(safeAreaBottom) + offset;
}
