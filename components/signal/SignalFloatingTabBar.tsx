import { BottomTabBar, type BottomTabBarProps } from "expo-router/js-tabs";
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarHorizontalMargin, tabBarPositionBottom } from '@/constants/tabBar';

/**
 * RN bottom-tabs 기본 `start/end: 0` 이 `left/right` 를 덮어 전체 너비로 붙는 문제를 피하기 위해
 * 바깥에서 inset·lift 를 적용한다.
 */
export function SignalFloatingTabBar(props: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const marginH = tabBarHorizontalMargin();
  const bottom = tabBarPositionBottom(insets.bottom);

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { left: marginH, right: marginH, bottom }]}>
      <BottomTabBar {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
  },
});
