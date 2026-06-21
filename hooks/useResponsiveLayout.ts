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
  const isIOS = Platform.OS === 'ios';
  const isPad = Platform.OS === 'ios' && Platform.isPad === true;
  const isWideLayout = isPad && width >= APP_WIDE_LAYOUT_MIN_WIDTH;
  const mode: ResponsiveLayoutMode = isWideLayout ? 'wide' : width >= 768 ? 'regular' : 'compact';

  return {
    width,
    height,
    isLandscape,
    isIOS,
    isPad,
    isWideLayout,
    useTwoPane: isWideLayout,
    mode,
    contentMaxWidth: isWideLayout ? APP_WIDE_CONTENT_MAX_WIDTH : APP_CONTENT_MAX_WIDTH,
  };
}
