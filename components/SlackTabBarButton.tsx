import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform, StyleSheet } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * 애플 뮤직/시스템 탭바처럼 틴트만으로 선택 표시(필 배경 없음) + 햅틱.
 * 웹에서 `hoverEffect.color`를 주면 React Navigation의 호버/프레스 오버레이가 생김.
 */
export function SlackTabBarButton(props: BottomTabBarButtonProps) {
  const { theme } = useSignalTheme();
  const { style, onPress, ...rest } = props;
  const flat = StyleSheet.flatten(style);
  const { flex: _flex, ...tabButtonStyle } = flat ?? {};

  return (
    <PlatformPressable
      {...rest}
      hitSlop={Platform.OS === 'web' ? undefined : { top: 4, bottom: 8, left: 2, right: 2 }}
      pressColor={Platform.OS === 'android' ? `${theme.green}55` : undefined}
      hoverEffect={
        Platform.OS === 'web'
          ? {
              color: theme.greenDim,
              hoverOpacity: 0.7,
              activeOpacity: 1,
            }
          : undefined
      }
      style={[
        tabButtonStyle,
        Platform.OS !== 'web' && {
          flexGrow: 0,
          flexShrink: 0,
          justifyContent: 'center',
          alignItems: 'center',
        },
        Platform.OS === 'web' && {
          borderRadius: 12,
          overflow: 'visible' as const,
        },
      ]}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          void Haptics.selectionAsync().catch(() => {
            /* Haptics unavailable on some simulators / builds */
          });
        }
        onPress?.(e);
      }}
    />
  );
}
