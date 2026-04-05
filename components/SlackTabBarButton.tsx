import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { PlatformPressable } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

/**
 * 선택 탭 필 + 햅틱. 기본 탭 레이아웃(column·padding)은 그대로 두고 배경만 덧씀.
 */
export function SlackTabBarButton(props: BottomTabBarButtonProps) {
  const { theme } = useSignalTheme();
  const selected = props.accessibilityState?.selected === true;
  const { style, onPress, ...rest } = props;

  return (
    <PlatformPressable
      {...rest}
      hitSlop={Platform.OS === 'web' ? undefined : { top: 4, bottom: 8, left: 2, right: 2 }}
      pressColor={Platform.OS === 'android' ? `${theme.green}55` : undefined}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          void Haptics.selectionAsync().catch(() => {
            /* Haptics unavailable on some simulators / builds */
          });
        }
        onPress?.(e);
      }}
      style={[
        style,
        selected && {
          backgroundColor: `${theme.green}34`,
          borderRadius: 10,
        },
      ]}
    />
  );
}
