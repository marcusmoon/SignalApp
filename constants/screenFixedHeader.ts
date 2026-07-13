import { Platform, StyleSheet } from 'react-native';

import type { AppTheme } from '@/constants/theme';
import { COMFORT_TOP_FIXED_GAP } from '@/constants/comfortDensity';
import {
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  SCREEN_FIXED_DIGEST_PADDING_BOTTOM,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/screenLayout';

/**
 * 스크롤 밖 상단 고정 스트립 — 세그먼트·날짜 바·필터·다이제스트 등.
 * `theme.card` 배경 + 하단 구분선으로 탭·스택 화면 공통.
 */
export function getScreenFixedHeaderStyles(theme: AppTheme) {
  const stripSurface = {
    backgroundColor: theme.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  };

  return {
    strip: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_FIXED_HEADER_PADDING_BOTTOM,
      gap: COMFORT_TOP_FIXED_GAP,
      ...stripSurface,
    },
    stripWide: {
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    /** 서브메뉴+다이제스트 고정 스택 — 배경 없음 */
    fixedStack: {
      flexShrink: 0,
      zIndex: 2,
      elevation: Platform.OS === 'android' ? 2 : 0,
      gap: COMFORT_TOP_FIXED_GAP,
    },
    fixedStackWide: {
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    /** 세그먼트·필터만 카드 배경 */
    submenuStrip: {
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
      paddingBottom: SCREEN_LIST_CONTENT_PADDING_TOP,
      ...stripSurface,
    },
    submenuStripWide: {
      paddingTop: 0,
    },
    /** 다이제스트 슬롯 — 카드 배경 없음 */
    digestSlot: {
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingBottom: SCREEN_FIXED_DIGEST_PADDING_BOTTOM,
    },
    digestSlotWide: {
      paddingHorizontal: 0,
      paddingBottom: SCREEN_FIXED_DIGEST_PADDING_BOTTOM,
    },
  } as const;
}
