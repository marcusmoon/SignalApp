import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import { GlassSurfaceBackground, floatingFabShadow } from '@/components/signal/GlassSurface';
import { APP_CONTENT_MAX_WIDTH, APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
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
  const { width } = useWindowDimensions();
  const lastPressAtRef = useRef(0);
  const fabRef = useRef<View | null>(null);
  const radius = FLOATING_GLASS_FAB_SIZE / 2;
  const fabShadow = useMemo(() => floatingFabShadow(effectiveColorScheme), [effectiveColorScheme]);
  const right = Math.max(APP_CONTENT_SIDE_PADDING, (width - APP_CONTENT_MAX_WIDTH) / 2 + APP_CONTENT_SIDE_PADDING);
  const effectiveDisabled = Platform.OS === 'web' ? false : Boolean(disabled);
  const surfaceBackground = Platform.OS === 'web' ? 'var(--signal-card)' : backgroundColor;
  const surfaceEdge = Platform.OS === 'web'
    ? { ring: 'var(--signal-border)', topHighlight: 'rgba(255,255,255,0.1)' }
    : edge;
  const iconColor = Platform.OS === 'web' ? 'var(--signal-green)' : theme.green;
  const triggerPress = useCallback(() => {
    if (effectiveDisabled) return;
    if (Date.now() - lastPressAtRef.current < 120) return;
    lastPressAtRef.current = Date.now();
    onPress();
  }, [effectiveDisabled, onPress]);
  const triggerWebFallback = useCallback((event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    if (effectiveDisabled) return;
    if (Date.now() - lastPressAtRef.current < 250) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    lastPressAtRef.current = Date.now();
    onPress();
  }, [effectiveDisabled, onPress]);
  const webDataProps = Platform.OS === 'web'
    ? ({
        dataSet: { signalFloatingFab: 'true' },
        onClick: triggerWebFallback,
        onPointerUp: triggerWebFallback,
      } as Record<string, unknown>)
    : undefined;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (fabRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
      ?.getScrollableNode?.()
      ?? document.querySelector('[data-signal-floating-fab="true"]');
    if (!node) return;

    const handleDomPress = (event: Event) => {
      triggerWebFallback({
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      });
    };

    node.addEventListener('click', handleDomPress);
    node.addEventListener('pointerup', handleDomPress);
    node.addEventListener('touchend', handleDomPress);
    return () => {
      node.removeEventListener('click', handleDomPress);
      node.removeEventListener('pointerup', handleDomPress);
      node.removeEventListener('touchend', handleDomPress);
    };
  }, [triggerWebFallback]);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        ref={fabRef as never}
        onPress={triggerPress}
        onPressIn={Platform.OS === 'web' ? triggerWebFallback : undefined}
        disabled={effectiveDisabled}
        hitSlop={10}
        {...webDataProps}
        style={({ pressed }) => [
          styles.fab,
          Platform.OS === 'web' ? styles.webFab : null,
          fabShadow,
          { bottom, right, borderRadius: radius },
          effectiveDisabled ? styles.fabDisabled : null,
          pressed && !effectiveDisabled ? styles.fabPressed : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: effectiveDisabled }}
        accessibilityLabel={accessibilityLabel}>
        <GlassSurfaceBackground
          backgroundColor={surfaceBackground}
          borderRadius={radius}
          edge={surfaceEdge}
          showTopHighlight={false}
        />
        <FontAwesome5 name={iconName} size={FAB_ICON_SIZE} color={iconColor} solid />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    zIndex: 1000,
    elevation: 24,
    width: FLOATING_GLASS_FAB_SIZE,
    height: FLOATING_GLASS_FAB_SIZE,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 8px 24px rgba(25, 31, 40, 0.2)',
          cursor: 'pointer',
        }
      : {}),
  },
  webFab: {
    position: 'fixed' as never,
    zIndex: 2147483001,
  },
  fabPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  fabDisabled: {
    opacity: 0.45,
  },
});
