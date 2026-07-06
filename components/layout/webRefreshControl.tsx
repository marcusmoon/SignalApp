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
const WEB_TOUCH_PULL_THRESHOLD = 80;
const WEB_WHEEL_PULL_THRESHOLD = 160;
const WEB_PULL_IDLE_MS = 180;

export function getWebRefreshControlProps(refreshControl: unknown): WebRefreshControlProps {
  return isValidElement(refreshControl)
    ? (refreshControl.props as Exclude<WebRefreshControlProps, null>)
    : null;
}

type WebRefreshOverlayProps = {
  pullProgress: number;
  pullActive: boolean;
  refreshing: boolean;
};

/** 스크롤 viewport 위 PTR 피드백 — 당김 중 얇은 바, 새로고침 중만 짧은 pill */
export function WebRefreshOverlay({ pullProgress, pullActive, refreshing }: WebRefreshOverlayProps) {
  const { t } = useLocale();
  const { theme, scaleFont } = useSignalTheme();
  const styles = useMemo(() => makeOverlayStyles(theme, scaleFont), [theme, scaleFont]);

  if (Platform.OS !== 'web') return null;

  const clampedProgress = Math.max(0, Math.min(1, pullProgress));
  const showPullHint = pullActive && !refreshing && clampedProgress > 0.06;
  const showRefreshing = refreshing;

  if (!showPullHint && !showRefreshing) return null;

  if (showRefreshing) {
    return (
      <View pointerEvents="none" style={styles.overlay}>
        <View
          style={styles.refreshPill}
          accessibilityRole="progressbar"
          accessibilityLabel={t('webRefreshing')}>
          <View {...({ dataSet: { signalWebRefreshSpinner: 'true' } } as object)} />
          <Text style={styles.refreshText}>{t('webRefreshing')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View
        style={styles.pullTrack}
        accessibilityRole="progressbar"
        accessibilityLabel={t('webPullToRefresh')}
        accessibilityValue={{
          min: 0,
          max: 100,
          now: Math.round(clampedProgress * 100),
        }}>
        <View style={[styles.pullFill, { width: `${Math.max(10, clampedProgress * 100)}%` }]} />
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
): { handlers: WebRefreshHandlerBag; pullProgress: number; pullActive: boolean } {
  const enabled = Platform.OS === 'web';
  const refreshRef = useRef(refreshControlProps);
  refreshRef.current = refreshControlProps;
  const isRefreshingRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef(false);
  const wheelPullDistanceRef = useRef(0);
  const lastRefreshAtRef = useRef(0);
  const [pullProgress, setPullProgress] = useState(0);
  const [pullActive, setPullActive] = useState(false);
  const pendingProgressRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pullIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetPullState = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingProgressRef.current = null;
    wheelPullDistanceRef.current = 0;
    touchStartYRef.current = null;
    touchTriggeredRef.current = false;
    setPullProgress(0);
    setPullActive(false);
    if (pullIdleTimerRef.current != null) {
      clearTimeout(pullIdleTimerRef.current);
      pullIdleTimerRef.current = null;
    }
  }, []);

  const schedulePullIdleReset = useCallback(() => {
    if (pullIdleTimerRef.current != null) {
      clearTimeout(pullIdleTimerRef.current);
    }
    pullIdleTimerRef.current = setTimeout(() => {
      pullIdleTimerRef.current = null;
      if (!isRefreshingRef.current) {
        resetPullState();
      }
    }, WEB_PULL_IDLE_MS);
  }, [resetPullState]);

  const setPullProgressRaf = useCallback(
    (value: number) => {
      if (isRefreshingRef.current) return;
      pendingProgressRef.current = Math.max(0, Math.min(1, value));
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingProgressRef.current != null && !isRefreshingRef.current) {
          setPullProgress(pendingProgressRef.current);
          pendingProgressRef.current = null;
        }
      });
    },
    [],
  );

  const markPullActive = useCallback(
    (progress: number) => {
      if (isRefreshingRef.current) return;
      setPullActive(true);
      setPullProgressRaf(progress);
      schedulePullIdleReset();
    },
    [schedulePullIdleReset, setPullProgressRaf],
  );

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      if (pullIdleTimerRef.current != null) clearTimeout(pullIdleTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    isRefreshingRef.current = !!refreshControlProps?.refreshing;
    if (!refreshControlProps?.refreshing) {
      resetPullState();
    }
  }, [refreshControlProps?.refreshing, resetPullState]);

  const triggerRefresh = useCallback(
    (node: HTMLElement | null) => {
      if (!enabled) return;
      if (!node || node.scrollTop > 2) return;

      const props = refreshRef.current;
      if (!props?.onRefresh || props.refreshing || props.enabled === false) return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < WEB_REFRESH_COOLDOWN_MS) return;
      lastRefreshAtRef.current = now;
      resetPullState();
      props.onRefresh();
    },
    [enabled, resetPullState],
  );

  const getTouchY = useCallback((event: unknown) => {
    const touches = (event as WebEvent)?.nativeEvent?.touches;
    const touch = touches?.[0];
    return touch?.clientY ?? touch?.pageY ?? null;
  }, []);

  const onTouchStart = useCallback(
    (event: unknown) => {
      const node = getNode(event);
      if (!enabled || isRefreshingRef.current) return;
      if (!node || node.scrollTop > 2) {
        resetPullState();
        return;
      }
      touchStartYRef.current = getTouchY(event);
      touchTriggeredRef.current = false;
      setPullActive(true);
      setPullProgressRaf(0);
    },
    [enabled, getNode, getTouchY, resetPullState, setPullProgressRaf],
  );

  const onTouchMove = useCallback(
    (event: unknown) => {
      const startY = touchStartYRef.current;
      if (!enabled || isRefreshingRef.current) return;
      if (startY == null) return;

      const y = getTouchY(event);
      if (y == null) return;

      const pull = y - startY;
      if (pull <= 0) {
        setPullProgressRaf(0);
        schedulePullIdleReset();
        return;
      }

      const progress = Math.min(1, pull / WEB_TOUCH_PULL_THRESHOLD);
      markPullActive(progress);

      if (touchTriggeredRef.current || progress < 1) return;
      touchTriggeredRef.current = true;
      triggerRefresh(getNode(event));
    },
    [enabled, getNode, getTouchY, markPullActive, schedulePullIdleReset, setPullProgressRaf, triggerRefresh],
  );

  const onTouchEnd = useCallback(() => {
    if (!isRefreshingRef.current) {
      schedulePullIdleReset();
    }
  }, [schedulePullIdleReset]);

  const onWheel = useCallback(
    (event: unknown) => {
      const node = getNode(event);
      if (!enabled || isRefreshingRef.current) return;
      if (!node || node.scrollTop > 2) {
        resetPullState();
        return;
      }

      const deltaY = (event as WebEvent)?.nativeEvent?.deltaY ?? (event as WebEvent)?.deltaY ?? 0;
      if (deltaY >= 0) {
        schedulePullIdleReset();
        return;
      }

      wheelPullDistanceRef.current += Math.abs(deltaY);
      const progress = Math.min(1, wheelPullDistanceRef.current / WEB_WHEEL_PULL_THRESHOLD);
      markPullActive(progress);

      if (wheelPullDistanceRef.current < WEB_WHEEL_PULL_THRESHOLD) return;
      wheelPullDistanceRef.current = 0;
      triggerRefresh(node);
    },
    [enabled, getNode, markPullActive, resetPullState, schedulePullIdleReset, triggerRefresh],
  );

  return {
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onWheel,
    },
    pullProgress,
    pullActive,
  };
}

function makeOverlayStyles(theme: ReturnType<typeof useSignalTheme>['theme'], sf: (n: number) => number) {
  return {
    overlay: {
      position: 'absolute',
      top: 6,
      left: 0,
      right: 0,
      zIndex: 30,
      alignItems: 'center',
      pointerEvents: 'none',
    } as const,
    pullTrack: {
      width: 96,
      height: 3,
      borderRadius: 2,
      backgroundColor: `${theme.border}`,
      overflow: 'hidden',
    } as const,
    pullFill: {
      height: '100%',
      borderRadius: 2,
      backgroundColor: theme.green,
      opacity: 0.85,
    } as const,
    refreshPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: WEB_SIGNAL_CSS.card,
      borderWidth: 1,
      borderColor: WEB_SIGNAL_CSS.border,
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    } as const,
    refreshText: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '700',
      color: theme.textMuted,
    } as const,
  };
}
