/**
 * 인-화면 세그먼트 탭 (실시간 시세: 관심/인기순/…, 설정 하위 탭, 유튜브 정렬 등)
 * 레이아웃 여백(marginBottom 등)은 화면마다 다를 수 있으나, pill·글자 크기는 여기 기준으로 통일한다.
 */
export const SEGMENT_TAB_OUTER_RADIUS = 10;
export const SEGMENT_TAB_PADDING = 4;
export const SEGMENT_TAB_GAP = 4;

export const SEGMENT_TAB_BTN_RADIUS = 8;
export const SEGMENT_TAB_BTN_PADDING_V = 8;

/** 라벨 — 시세 화면 세그먼트와 동일 */
export const SEGMENT_TAB_FONT_SIZE = 13;
export const SEGMENT_TAB_LINE_HEIGHT = 17;
export const SEGMENT_TAB_FONT_WEIGHT = '800' as const;

export const SEGMENT_TAB_ACTIVE_TEXT = '#FFFFFF';

/** 세그먼트/고정 헤더 아래 스크롤 리스트 상단 여백 */
export const SCREEN_LIST_CONTENT_PADDING_TOP = 8;
/** 2-pane 본문 컬럼 상단 여백 */
export const SCREEN_WIDE_CONTENT_PADDING_TOP = 12;
/** FlatList ListHeaderComponent 블록 */
export const SCREEN_LIST_HEADER_PADDING_TOP = 8;
export const SCREEN_LIST_HEADER_PADDING_BOTTOM = 4;
/** 사이드바 컨텍스트 서브탭 아래 여백 */
export const SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM = 12;
