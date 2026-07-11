/**
 * 인-화면 세그먼트 탭 (실시간 시세: 관심/인기순/…, 설정 하위 탭, 시장 세션 등)
 * 레이아웃 여백(marginBottom 등)은 화면마다 다를 수 있으나, pill·색상은 여기 기준으로 통일한다.
 */
import type { AppTheme } from '@/constants/theme';
import {
  UI_RADIUS_SEGMENT_BTN,
  UI_RADIUS_SEGMENT_OUTER,
} from '@/constants/uiCornerRadius';

export const SEGMENT_TAB_OUTER_RADIUS = UI_RADIUS_SEGMENT_OUTER;
export const SEGMENT_TAB_PADDING = 4;
export const SEGMENT_TAB_GAP = 4;

export const SEGMENT_TAB_BTN_RADIUS = UI_RADIUS_SEGMENT_BTN;
export const SEGMENT_TAB_BTN_PADDING_V = 10;

/** 라벨 — 시세 화면 세그먼트와 동일 */
export const SEGMENT_TAB_FONT_SIZE = 13;
export const SEGMENT_TAB_LINE_HEIGHT = 17;
export const SEGMENT_TAB_FONT_WEIGHT = '800' as const;

export const SEGMENT_TAB_ACTIVE_TEXT = '#FFFFFF';

/** iPhone 탭 화면 상단 세그먼트 pill 바 — 모든 탭 화면이 동일한 모양·색상을 쓴다. */
export function getSegmentTabBarStyles(theme: AppTheme, sf: (n: number) => number) {
  return {
    segment: {
      flexDirection: 'row' as const,
      backgroundColor: theme.bgElevated,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 0,
      gap: SEGMENT_TAB_GAP,
    },
    segBtn: {
      flex: 1,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    segBtnCompact: {
      flex: 0.86,
    },
    segBtnVideo: {
      flex: 0.86,
    },
    segmentDivider: {
      width: 1,
      height: 18,
      alignSelf: 'center' as const,
      marginHorizontal: 2,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    segBtnActive: {
      backgroundColor: theme.green,
    },
    segBtnDisabled: {
      opacity: 0.38,
    },
    segText: {
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    segTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    segTextDisabled: {
      color: theme.textDim,
    },
  };
}

export {
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_HEADER_PADDING_BOTTOM,
  SCREEN_LIST_HEADER_PADDING_TOP,
  SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';
export { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
