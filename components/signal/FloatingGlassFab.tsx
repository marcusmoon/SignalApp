import type { ComponentProps } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';

import { useSignalTheme } from '@/contexts/SignalThemeContext';

export const FLOATING_GLASS_FAB_SIZE = 52;
export const FLOATING_GLASS_FAB_GAP = 12;

type FaName = ComponentProps<typeof FontAwesome>['name'];

type Props = {
  bottom: number;
  onPress: () => void;
  iconName: FaName;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function FloatingGlassFab({ bottom, onPress, iconName, accessibilityLabel, disabled }: Props) {
  const { theme } = useSignalTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.fab,
        { bottom },
        disabled ? styles.fabDisabled : null,
        pressed && !disabled ? styles.fabPressed : null,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      accessibilityLabel={accessibilityLabel}>
      {Platform.OS === 'web' ? (
        <View style={[styles.blurFallback, { backgroundColor: theme.card }]} />
      ) : (
        <BlurView
          intensity={Platform.OS === 'ios' ? 82 : 70}
          tint="light"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
      )}
      <View pointerEvents="none" style={[styles.ring, { borderColor: theme.border }]} />
      <FontAwesome name={iconName} size={19} color={theme.green} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    width: FLOATING_GLASS_FAB_SIZE,
    height: FLOATING_GLASS_FAB_SIZE,
    borderRadius: FLOATING_GLASS_FAB_SIZE / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#191F28',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 10,
  },
  blurFallback: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FLOATING_GLASS_FAB_SIZE / 2,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FLOATING_GLASS_FAB_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fabPressed: {
    opacity: 0.9,
  },
  fabDisabled: {
    opacity: 0.45,
  },
});
