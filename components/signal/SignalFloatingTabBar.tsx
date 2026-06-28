import { BottomTabBar, type BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurfaceBackground, floatingGlassShadow } from '@/components/signal/GlassSurface';
import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  TAB_BAR_FLOAT_HEIGHT,
  TAB_BAR_FLOAT_RADIUS,
  tabBarHorizontalMargin,
  tabBarPositionBottom,
} from '@/constants/tabBar';
import { useTabBarGlassStyle } from '@/hooks/useTabBarGlassStyle';

/**
 * RN bottom-tabs 기본 `start/end: 0` 이 `left/right` 를 덮어 전체 너비로 붙는 문제를 피하기 위해
 * 바깥에서 inset·lift 를 적용한다.
 */
export function SignalFloatingTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { backgroundColor, edge, effectiveColorScheme } = useTabBarGlassStyle();
  const marginH = tabBarHorizontalMargin();
  const bottom = tabBarPositionBottom(insets.bottom);
  const availableWidth = Math.max(0, width - marginH * 2);
  const tabBarWidth = Math.min(availableWidth, APP_CONTENT_MAX_WIDTH);
  const left = Math.max(marginH, (width - tabBarWidth) / 2);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        floatingGlassShadow(effectiveColorScheme),
        { left, width: tabBarWidth, bottom, backgroundColor },
      ]}>
      <GlassSurfaceBackground
        backgroundColor={backgroundColor}
        borderRadius={TAB_BAR_FLOAT_RADIUS}
        edge={edge}
        showTopHighlight
      />
      <BottomTabBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    height: TAB_BAR_FLOAT_HEIGHT + 13,
    borderRadius: TAB_BAR_FLOAT_RADIUS,
    overflow: 'hidden',
  },
});
