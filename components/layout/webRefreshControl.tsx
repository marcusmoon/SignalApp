import FontAwesome from '@expo/vector-icons/FontAwesome';
import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';

import { WEB_SIGNAL_CSS } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

export type WebRefreshControlProps = {
  enabled?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
} | null;

type WebEvent = {
  currentTarget?: HTMLElement | null;
  nativeEvent?: {
    deltaY?: number;
    touches?: Array<{ clientY?: number; pageY?: number }>;
  };
  deltaY?: number;
};

const WEB_REFRESH_COOLDOWN_MS = 1000;
const WEB_TOUCH_PULL_THRESHOLD = 72;
const WEB_WHEEL_PULL_THRESHOLD = 110;

export function getWebRefreshControlProps(refreshControl: unknown): WebRefreshControlProps {
  return isValidElement(refreshControl)
    ? (refreshControl.props as Exclude<WebRefreshControlProps, null>)
    : null;
}

type WebRefreshOverlayProps = {
  pullProgress: number;
  refreshing: boolean;
};

/** 스크롤 viewport 위 PTR 피드백 — 당김 진행률 + 새로고침 상태 */
export function WebRefreshOverlay({ pullProgress, refreshing }: WebRefreshOverlayProps) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeOverlayStyles(theme, scaleFont), [theme, scaleFont]);

  if (Platform.OS !== 'web') return null;

  const clampedProgress = Math.max(0, Math.min(1, pullProgress));
  const visible = refreshing || clampedProgress > 0.04;
  if (!visible) return null;

  const ready = clampedProgress >= 1 && !refreshing;
  const message = refreshing
    ? t('webRefreshing')
    : ready
      ? t('webReleaseToRefresh')
      : t('webPullToRefresh');
  const opacity = refreshing ? 1 : Math.min(1, 0.35 + clampedProgress * 0.65);
  const translateY = refreshing ? 0 : (1 - clampedProgress) * -18;
  const scale = refreshing ? 1 : 0.9 + clampedProgress * 0.1;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View
        style={[
          styles.pill,
          ready && styles.pillReady,
          refreshing && styles.pillRefreshing,
          {
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
        accessibilityRole="progressbar"
        accessibilityLabel={message}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: refreshing ? 100 : Math.round(clampedProgress * 100),
        }}>
        {refreshing ? (
          <View {...({ dataSet: { signalWebRefreshSpinner: 'true' } } as object)} />
        ) : (
          <FontAwesome
            name="arrow-down"
            size={14}
            color={ready ? theme.green : theme.textMuted}
            style={{
              transform: [{ rotate: `${Math.min(180, clampedProgress * 180)}deg` }],
            }}
          />
        )}
        <Text style={[styles.message, ready && styles.messageReady, refreshing && styles.messageRefreshing]}>
          {message}
        </Text>
        {!refreshing ? (
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                ready && styles.progressFillReady,
                { width: `${Math.max(8, clampedProgress * 100)}%` },
              ]}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export type WebRefreshHandlerBag = {
  onTouchStart: (event: unknown) => void;
  onTouchMove: (event: unknown) => void;
  onTouchEnd: () => void;
  onWheel: (event: unknown) => void;
};

export function useWebRefreshHandlers(
  refreshControlProps: WebRefreshControlProps,
  getNode: (event?: unknown) => HTMLElement | null,
): { handlers: WebRefreshHandlerBag; pullProgress: number } {
  const enabled = Platform.OS === 'web';
  const refreshRef = useRef(refreshControlProps);
  refreshRef.current = refreshControlProps;
  const touchStartYRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef(false);
  const wheelPullDistanceRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const [pullProgress, setPullProgress] = useState(0);
  const pendingProgressRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const setPullProgressRaf = useCallback((value: number) => {
    pendingProgressRef.current = Math.max(0, Math.min(1, value));
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingProgressRef.current != null) {
        setPullProgress(pendingProgressRef.current);
        pendingProgressRef.current = null;
      }
    });
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!refreshControlProps?.refreshing) {
      setPullProgress(0);
      wheelPullDistanceRef.current = 0;
    }
  }, [refreshControlProps?.refreshing]);

  const triggerRefresh = useCallback(
    (node: HTMLElement | null) => {
      if (!enabled) return;
      if (!node || node.scrollTop > 2) return;

      const props = refreshRef.current;
      if (!props?.onRefresh || props.refreshing || props.enabled === false) return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < WEB_REFRESH_COOLDOWN_MS) return;
      lastRefreshAtRef.current = now;
      setPullProgressRaf(1);
      props.onRefresh();
    },
    [enabled, setPullProgressRaf],
  );

  const getTouchY = useCallback((event: unknown) => {
    const touches = (event as WebEvent)?.nativeEvent?.touches;
    const touch = touches?.[0];
    return touch?.clientY ?? touch?.pageY ?? null;
  }, []);

  const onTouchStart = useCallback(
    (event: unknown) => {
      const node = getNode(event);
      if (!enabled) return;
      if (!node || node.scrollTop > 2) {
        touchStartYRef.current = null;
        setPullProgressRaf(0);
        return;
      }
      touchStartYRef.current = getTouchY(event);
      touchTriggeredRef.current = false;
      setPullProgressRaf(0);
    },
    [enabled, getNode, getTouchY, setPullProgressRaf],
  );

  const onTouchMove = useCallback(
    (event: unknown) => {
      const startY = touchStartYRef.current;
      if (!enabled) return;
      if (startY == null) return;

      const y = getTouchY(event);
      if (y == null) return;

      const pull = y - startY;
      if (pull <= 0) {
        setPullProgressRaf(0);
        return;
      }

      const progress = Math.min(1, pull / WEB_TOUCH_PULL_THRESHOLD);
      setPullProgressRaf(progress);

      if (touchTriggeredRef.current || progress < 1) return;
      touchTriggeredRef.current = true;
      triggerRefresh(getNode(event));
    },
    [enabled, getNode, getTouchY, setPullProgressRaf, triggerRefresh],
  );

  const onTouchEnd = useCallback(() => {
    touchStartYRef.current = null;
    touchTriggeredRef.current = false;
    wheelPullDistanceRef.current = 0;
    if (!refreshRef.current?.refreshing) {
      setPullProgressRaf(0);
    }
  }, [setPullProgressRaf]);

  const onWheel = useCallback(
    (event: unknown) => {
      const node = getNode(event);
      if (!enabled) return;
      if (!node || node.scrollTop > 2) {
        wheelPullDistanceRef.current = 0;
        setPullProgressRaf(0);
        return;
      }

      const deltaY = (event as WebEvent)?.nativeEvent?.deltaY ?? (event as WebEvent)?.deltaY ?? 0;
      if (deltaY >= 0) {
        wheelPullDistanceRef.current = 0;
        setPullProgressRaf(0);
        return;
      }

      wheelPullDistanceRef.current += Math.abs(deltaY);
      const progress = Math.min(1, wheelPullDistanceRef.current / WEB_WHEEL_PULL_THRESHOLD);
      setPullProgressRaf(progress);

      if (wheelPullDistanceRef.current < WEB_WHEEL_PULL_THRESHOLD) return;
      wheelPullDistanceRef.current = 0;
      triggerRefresh(node);
    },
    [enabled, getNode, setPullProgressRaf, triggerRefresh],
  );

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onWheel,
    },
    pullProgress,
  };
}

function makeOverlayStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return {
    overlay: {
      position: 'absolute',
      top: 8,
      left: 0,
      right: 0,
      zIndex: 30,
      alignItems: 'center',
      pointerEvents: 'none',
    } as const,
    pill: {
      minWidth: 220,
      maxWidth: 320,
      paddingTop: 10,
      paddingBottom: 9,
      paddingHorizontal: 14,
      borderRadius: 18,
      alignItems: 'center',
      gap: 6,
      backgroundColor: WEB_SIGNAL_CSS.card,
      borderWidth: 1,
      borderColor: WEB_SIGNAL_CSS.border,
      boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
    } as const,
    pillReady: {
      borderColor: `${theme.green}88`,
      backgroundColor: theme.greenDim,
    } as const,
    pillRefreshing: {
      borderColor: `${theme.green}88`,
    } as const,
    message: {
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.textMuted,
      textAlign: 'center',
    } as const,
    messageReady: {
      color: theme.green,
    } as const,
    messageRefreshing: {
      color: theme.text,
    } as const,
    progressTrack: {
      alignSelf: 'stretch',
      height: 3,
      borderRadius: 2,
      backgroundColor: `${theme.border}`,
      overflow: 'hidden',
    } as const,
    progressFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: theme.textMuted,
    } as const,
    progressFillReady: {
      backgroundColor: theme.green,
    } as const,
  };
}
