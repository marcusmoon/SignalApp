/**
 * iPad와 넓은 웹 화면에서 모바일 UI가 과하게 퍼지지 않도록 하는 공통 폭.
 * iPhone에서는 width: 100%로 동작하고, 넓은 화면에서는 중앙 정렬한다.
 */
export const APP_CONTENT_MAX_WIDTH = 720;

export const APP_WIDE_LAYOUT_MIN_WIDTH = 900;

export const APP_WIDE_CONTENT_MAX_WIDTH = 1120;

export const APP_CONTENT_SIDE_PADDING = 16;

/** Tab/list screens in wide mode: fill the sidebar content pane edge-to-edge */
export const wideContentFill = {
  width: '100%' as const,
  maxWidth: '100%' as const,
  alignSelf: 'stretch' as const,
};

/** iPad 사이드바 내비게이션 폭 */
export const SIDEBAR_WIDTH = 200;

/** 2-패널 레이아웃에서 마스터(좌측) 패널의 최소 폭 */
export const MASTER_PANEL_MIN_WIDTH = 280;

/** 2-패널 레이아웃에서 마스터(좌측) 패널의 최대 폭 비율 */
export const MASTER_PANEL_WIDTH_RATIO = 0.36;
