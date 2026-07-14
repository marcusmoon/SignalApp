import { Platform, useWindowDimensions } from 'react-native';

import {
  APP_CONTENT_MAX_WIDTH,
  APP_WIDE_CONTENT_MAX_WIDTH,
  APP_WIDE_LAYOUT_MIN_WIDTH,
} from '@/constants/responsiveLayout';

export type ResponsiveLayoutMode = 'compact' | 'regular' | 'wide';

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const isWeb = Platform.OS === 'web';
  const isIOS = Platform.OS === 'ios';
  const isPad = isIOS && 'isPad' in Platform && Platform.isPad === true;
  /**
   * Wide shell (sidebar + in-pane overlays):
   * - Native iPad: always — portrait widths are often under 900 but still use two-pane.
   * - Web: only when width ≥ APP_WIDE_LAYOUT_MIN_WIDTH (phone browsers stay compact).
   */
  const isWideLayout = isPad || (isWeb && width >= APP_WIDE_LAYOUT_MIN_WIDTH);
  const mode: ResponsiveLayoutMode = isWideLayout ? 'wide' : width >= 768 ? 'regular' : 'compact';

  return {
    width,
    height,
    isLandscape,
    isWeb,
    isIOS,
    isPad,
    isWideLayout,
    useTwoPane: isWideLayout,
    mode,
    contentMaxWidth: isWideLayout ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
  };
}
