import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * 애플 뮤직/시스템 탭바처럼 틴트만으로 선택 표시(필 배경 없음) + 햅틱.
 * 웹에서 `hoverEffect.color`를 주면 React Navigation의 호버/프레스 오버레이가 생김.
 */
export function SlackTabBarButton(props: BottomTabBarButtonProps) {
  const { theme } = useSignalTheme();
  const { style, onPress, ...rest } = props;

  return (
    <PlatformPressable
      {...rest}
      hitSlop={Platform.OS === 'web' ? undefined : { top: 4, bottom: 8, left: 2, right: 2 }}
      pressColor={Platform.OS === 'android' ? `${theme.green}55` : undefined}
      hoverEffect={
        Platform.OS === 'web'
          ? {
              color: 'rgba(255,255,255,0.14)',
              hoverOpacity: 0.14,
              activeOpacity: 0.22,
            }
          : undefined
      }
      style={[
        style,
        Platform.OS === 'web' && {
          borderRadius: 12,
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
