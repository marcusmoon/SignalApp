import type { ComponentProps, RefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';

import { GlassSurfaceBackground, floatingFabShadow } from '@/components/signal/GlassSurface';
import { APP_CONTENT_MAX_WIDTH, APP_CONTENT_SIDE_PADDING } from '@/constants/responsiveLayout';
import { isWeb, WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useWebDomPressFallback } from '@/hooks/useWebDomPressFallback';
import { useTabBarGlassStyle } from '@/hooks/useTabBarGlassStyle';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { scrollToTopWithRetry, type ScrollToTopTarget } from '@/utils/scrollToTop';

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
  /** 토글·필터 등 선택된 상태 */
  active?: boolean;
  /** List to scroll to top before refresh (FAB). */
  listRef?: RefObject<ScrollToTopTarget>;
};

export function FloatingGlassFab({
  bottom,
  onPress,
  iconName,
  accessibilityLabel,
  disabled,
  active = false,
  listRef,
}: Props) {
  const { theme } = useSignalTheme();
  const { backgroundColor, edge, effectiveColorScheme } = useTabBarGlassStyle();
  const { useTwoPane, width } = useResponsiveLayout();
  const lastPressAtRef = useRef(0);
  const fabRef = useRef<View | null>(null);
  const radius = FLOATING_GLASS_FAB_SIZE / 2;
  const fabShadow = useMemo(() => floatingFabShadow(effectiveColorScheme), [effectiveColorScheme]);
  /** wide(iPad·웹): 콘텐츠 pane 우측 inset. phone: 720px 중앙 컬럼 우측. */
  const right = useMemo(
    () =>
      useTwoPane
        ? APP_CONTENT_SIDE_PADDING
        : Math.max(APP_CONTENT_SIDE_PADDING, (width - APP_CONTENT_MAX_WIDTH) / 2 + APP_CONTENT_SIDE_PADDING),
    [useTwoPane, width],
  );
  const effectiveDisabled = isWeb ? false : Boolean(disabled);
  const surfaceBackground = active
    ? theme.greenDim
    : isWeb
      ? WEB_SIGNAL_CSS.card
      : backgroundColor;
  const surfaceEdge = active
    ? { ring: theme.greenBorder, topHighlight: theme.greenBorder }
    : isWeb
      ? { ring: WEB_SIGNAL_CSS.border, topHighlight: WEB_SIGNAL_CSS.topHighlight }
      : edge;
  const iconColor = active ? theme.green : theme.textMuted;
  const firePress = useCallback(() => {
    if (listRef) scrollToTopWithRetry(listRef, false);
    onPress();
  }, [listRef, onPress]);
  const triggerPress = useCallback(() => {
    if (effectiveDisabled) return;
    if (Date.now() - lastPressAtRef.current < 120) return;
    lastPressAtRef.current = Date.now();
    firePress();
  }, [effectiveDisabled, firePress]);
  const triggerWebFallback = useCallback((event?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
    if (effectiveDisabled) return;
    if (Date.now() - lastPressAtRef.current < 250) return;
    event?.preventDefault?.();
    event?.stopPropagation?.();
    lastPressAtRef.current = Date.now();
    firePress();
  }, [effectiveDisabled, firePress]);
  const webDataProps = isWeb
    ? ({
        dataSet: {
          signalFloatingFab: 'true',
          // Lets +html CSS skip phone tab-bar clearance on wide chrome.
          signalChrome: useTwoPane ? 'wide' : 'phone',
        },
        onClick: triggerWebFallback,
        onPointerUp: triggerWebFallback,
      } as Record<string, unknown>)
    : undefined;

  useWebDomPressFallback(fabRef, '[data-signal-floating-fab="true"]', triggerWebFallback);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <Pressable
        ref={fabRef as never}
        onPress={triggerPress}
        onPressIn={isWeb ? triggerWebFallback : undefined}
        disabled={effectiveDisabled}
        hitSlop={10}
        {...webDataProps}
        style={({ pressed }) => [
          styles.fab,
          isWeb ? styles.webFab : null,
          fabShadow,
          { bottom, right, borderRadius: radius },
          active ? [styles.fabActive, { borderColor: theme.greenBorder }] : null,
          effectiveDisabled ? styles.fabDisabled : null,
          pressed && !effectiveDisabled ? styles.fabPressed : null,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled: effectiveDisabled, selected: active }}
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
    ...(isWeb
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
  fabActive: {
    borderWidth: 1,
  },
  fabDisabled: {
    opacity: 0.45,
  },
});
