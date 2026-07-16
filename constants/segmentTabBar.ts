/**
 * 인-화면 세그먼트 탭 (시세·설정·시장 세션·뉴스 등)
 * Underline: 트랙/채움 pill 없이 활성만 하단 green 라인 + 텍스트 강조.
 */
import { StyleSheet } from 'react-native';

import type { AppTheme } from '@/constants/theme';

export const SEGMENT_TAB_OUTER_RADIUS = 0;
export const SEGMENT_TAB_PADDING = 0;
export const SEGMENT_TAB_GAP = 0;

export const SEGMENT_TAB_BTN_RADIUS = 0;
export const SEGMENT_TAB_BTN_PADDING_V = 10;
/** 활성 하단 인디케이터 */
export const SEGMENT_TAB_UNDERLINE_WIDTH = 2;

/** 라벨 — 시세 화면 세그먼트와 동일 */
export const SEGMENT_TAB_FONT_SIZE = 13;
export const SEGMENT_TAB_LINE_HEIGHT = 17;
export const SEGMENT_TAB_FONT_WEIGHT = '600' as const;
export const SEGMENT_TAB_FONT_WEIGHT_ACTIVE = '700' as const;

/**
 * @deprecated underline 스타일에서는 활성 텍스트가 `theme.text`.
 * 과거 filled-pill 호환용으로만 남겨 둔다.
 */
export const SEGMENT_TAB_ACTIVE_TEXT = '#FFFFFF';

/** iPhone 탭 화면 상단 세그먼트 — 모든 탭 화면이 동일한 모양·색상을 쓴다. */
export function getSegmentTabBarStyles(theme: AppTheme, sf: (n: number) => number) {
  const hairline = StyleSheet.hairlineWidth;
  return {
    segment: {
      flexDirection: 'row' as const,
      backgroundColor: 'transparent',
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 0,
      borderBottomWidth: hairline,
      borderBottomColor: theme.border,
      borderColor: 'transparent',
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 0,
      gap: SEGMENT_TAB_GAP,
      alignItems: 'stretch' as const,
    },
    segBtn: {
      flex: 1,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      paddingHorizontal: 6,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: 'transparent',
      borderBottomWidth: SEGMENT_TAB_UNDERLINE_WIDTH,
      borderBottomColor: 'transparent',
      marginBottom: -hairline,
    },
    segBtnCompact: {
      flex: 0.86,
    },
    segBtnVideo: {
      flex: 0.86,
    },
    segmentDivider: {
      width: hairline,
      height: 14,
      alignSelf: 'center' as const,
      marginHorizontal: 2,
      borderRadius: 999,
      backgroundColor: theme.border,
    },
    segBtnActive: {
      backgroundColor: 'transparent',
      borderBottomColor: theme.green,
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
      color: theme.text,
      fontWeight: SEGMENT_TAB_FONT_WEIGHT_ACTIVE,
    },
    segTextDisabled: {
      color: theme.textDim,
    },
  };
}

export {
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  SCREEN_DIGEST_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_LIST_HEADER_PADDING_BOTTOM,
  SCREEN_LIST_HEADER_PADDING_TOP,
  SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';
export { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
