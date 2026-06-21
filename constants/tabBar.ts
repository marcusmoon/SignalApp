import { Platform } from 'react-native';

/**
 * 하단 탭바 — 좌우 inset + 홈 인디케이터 위 lift + 둥근 플로팅 캡슐.
 * `app/(tabs)/_layout.tsx`와 스크롤 하단 패딩·FAB 위치에 맞출 것.
 */

export function tabBarFloatMarginBottom(): number {
  if (Platform.OS === 'ios') return TAB_BAR_FLOAT_MARGIN_BOTTOM_IOS;
  if (Platform.OS === 'android') return TAB_BAR_FLOAT_MARGIN_BOTTOM_ANDROID;
  return TAB_BAR_FLOAT_MARGIN_BOTTOM + 2;
}

/**
 * iOS Slack 스타일: 인디케이터 위 + 하단 라운드·테두리가 비치도록 safe area 일부만 lift.
 * Android·웹: safe area + lift.
 */
export function tabBarPositionBottom(safeAreaBottom: number): number {
  if (Platform.OS === 'ios') {
    return slackTabBarBottomOffset(safeAreaBottom);
  }
  return safeAreaBottom + tabBarFloatMarginBottom();
}

/** 스크롤·FAB: 탭바 `bottom` 오프셋(높이는 `useBottomTabBarHeight` 와 합산) */
export function tabBarBottomInset(safeAreaBottom: number): number {
  if (Platform.OS === 'ios') {
    return slackTabBarBottomOffset(safeAreaBottom);
  }
  return safeAreaBottom + tabBarFloatMarginBottom();
}

function slackTabBarBottomOffset(safeAreaBottom: number): number {
  const insetLift = Math.round(safeAreaBottom * 0.28);
  return Math.max(14, insetLift + TAB_BAR_FLOAT_MARGIN_BOTTOM_IOS);
}

export function tabBarHorizontalMargin(): number {
  if (Platform.OS === 'ios') return TAB_BAR_FLOAT_MARGIN_H_IOS;
  if (Platform.OS === 'android') return TAB_BAR_FLOAT_MARGIN_H_ANDROID;
  return TAB_BAR_FLOAT_MARGIN_H;
}

/**
 * 피드·카드 리스트와 동일한 화면 가로 inset (`paddingHorizontal: 16`).
 * 탭바 너비 = 콘텐츠(뉴스·시세 등) 너비와 맞춤.
 */
export const TAB_BAR_FLOAT_MARGIN_H = 16;
export const TAB_BAR_FLOAT_MARGIN_H_IOS = 16;
export const TAB_BAR_FLOAT_MARGIN_H_ANDROID = 16;
/** 웹: safe area 아래 추가 lift */
export const TAB_BAR_FLOAT_MARGIN_BOTTOM = 6;
/** Android: 홈 제스처 위 간격 */
export const TAB_BAR_FLOAT_MARGIN_BOTTOM_ANDROID = 3;
/** iOS: `slackTabBarBottomOffset` 에 더하는 추가 lift */
export const TAB_BAR_FLOAT_MARGIN_BOTTOM_IOS = 8;
/** 플로팅 캡슐 모서리 — 높이와 함께 키워 pill 형태 유지 */
export const TAB_BAR_FLOAT_RADIUS = 30;
/** 아이콘+라벨 행 높이(캡슐 내부, uikit padding 5×2 + 아이콘 25 + 라벨 ~15) */
export const TAB_BAR_FLOAT_HEIGHT = 54;

/** 하단 탭 표시 순서 — `app/(tabs)/_layout.tsx`의 표시 탭 순서와 동일 */
export const TAB_BAR_SCREEN_ORDER = ['index', 'news', 'disclosures', 'signal', 'quotes', 'more'] as const;
