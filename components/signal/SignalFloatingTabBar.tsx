import type { BottomTabBarProps } from "expo-router/js-tabs";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const VISIBLE_TAB_NAMES = new Set(['home', 'news', 'signal', 'quotes', 'more']);

/**
 * BottomTabBar 내부 surface는 플랫폼별 기본 스타일을 강하게 갖고 있어 테마/투명도 적용이 흔들릴 수 있다.
 * SIGNAL 탭바는 route descriptor의 icon/title만 재사용하고 surface·button·press를 직접 통제한다.
 */
export function SignalFloatingTabBar(props: BottomTabBarProps) {
  const { state, descriptors, navigation } = props;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { theme, scaleFont } = useSignalTheme();
  const { backgroundColor, edge, effectiveColorScheme } = useTabBarGlassStyle();
  const marginH = tabBarHorizontalMargin();
  const bottom = tabBarPositionBottom(insets.bottom);
  const availableWidth = Math.max(0, width - marginH * 2);
  const tabBarWidth = Math.min(availableWidth, APP_CONTENT_MAX_WIDTH);
  const left = Math.max(marginH, (width - tabBarWidth) / 2);
  const hostHeight = Platform.OS === 'web' ? TAB_BAR_FLOAT_HEIGHT + 29 : TAB_BAR_FLOAT_HEIGHT + 13;
  const visibleRoutes = state.routes.filter((route) => {
    return VISIBLE_TAB_NAMES.has(route.name);
  });

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        floatingGlassShadow(effectiveColorScheme),
        { left, width: tabBarWidth, bottom, height: hostHeight, backgroundColor },
      ]}>
      <GlassSurfaceBackground
        backgroundColor={backgroundColor}
        borderRadius={TAB_BAR_FLOAT_RADIUS}
        edge={edge}
        showTopHighlight
      />
      <View style={styles.row}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.key === route.key);
          const focused = state.index === routeIndex;
          const descriptor = descriptors[route.key];
          const options = descriptor.options;
          const color = focused
            ? options.tabBarActiveTintColor ?? theme.green
            : options.tabBarInactiveTintColor ?? theme.textMuted;
          const labelBase =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : options.title ?? route.name;
          const label =
            typeof options.tabBarLabel === 'function'
              ? options.tabBarLabel({
                  focused,
                  color,
                  position: 'below-icon',
                  children: labelBase,
                })
              : labelBase;
          const icon = options.tabBarIcon?.({ focused, color, size: 25 });

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarButtonTestID}
              hitSlop={{ top: 6, bottom: 8, left: 4, right: 4 }}
              style={({ pressed }) => [
                styles.item,
                pressed ? styles.itemPressed : null,
              ]}>
              <View style={styles.iconSlot}>{icon}</View>
              {options.tabBarShowLabel === false ? null : (
                typeof label === 'string' ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.label,
                      {
                        color,
                        fontSize: scaleFont(11),
                        lineHeight: scaleFont(14),
                      },
                    ]}>
                    {label}
                  </Text>
                ) : (
                  label
                )
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    borderRadius: TAB_BAR_FLOAT_RADIUS,
    overflow: 'hidden',
    zIndex: 900,
    elevation: 20,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 7,
  },
  item: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  itemPressed: {
    opacity: 0.78,
  },
  iconSlot: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 1,
    fontWeight: '800',
    textAlign: 'center',
  },
});
