import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import { GlassSurfaceBackground, floatingFabShadow } from '@/components/signal/GlassSurface';
import { useTabBarGlassStyle } from '@/hooks/useTabBarGlassStyle';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

/** 탭바 콘텐츠 높이(54)와 맞춘 원형 FAB */
export const FLOATING_GLASS_FAB_SIZE = 56;
export const FLOATING_GLASS_FAB_GAP = 12;
const FAB_ICON_SIZE = 20;

type FaName = ComponentProps<typeof FontAwesome5>['name'];

type Props = {
  bottom: number;
  onPress: () => void;
  iconName: FaName;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function FloatingGlassFab({ bottom, onPress, iconName, accessibilityLabel, disabled }: Props) {
  const { theme } = useSignalTheme();
  const { backgroundColor, edge, effectiveColorScheme } = useTabBarGlassStyle();
  const radius = FLOATING_GLASS_FAB_SIZE / 2;
  const fabShadow = useMemo(() => floatingFabShadow(effectiveColorScheme), [effectiveColorScheme]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.fab,
        fabShadow,
        { bottom, borderRadius: radius },
        disabled ? styles.fabDisabled : null,
        pressed && !disabled ? styles.fabPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}>
      <GlassSurfaceBackground
        backgroundColor={backgroundColor}
        borderRadius={radius}
        edge={edge}
        showTopHighlight={false}
      />
      <FontAwesome5 name={iconName} size={FAB_ICON_SIZE} color={theme.green} solid />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: FLOATING_GLASS_FAB_SIZE,
    height: FLOATING_GLASS_FAB_SIZE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 8px 24px rgba(25, 31, 40, 0.2)',
        }
      : {}),
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  fabDisabled: {
    opacity: 0.45,
  },
});
