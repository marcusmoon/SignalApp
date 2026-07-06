import { isValidElement, useCallback, useRef } from 'react';
import { Platform, View } from 'react-native';

import { WEB_SIGNAL_CSS } from '@/constants/webLayout';

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

export function getWebRefreshControlProps(refreshControl: unknown): WebRefreshControlProps {
  return isValidElement(refreshControl)
    ? (refreshControl.props as Exclude<WebRefreshControlProps, null>)
    : null;
}

/** 웹 PTR 진행 표시 — CSS 스피너(리스트 밖 오버레이용) */
export function WebRefreshStatus() {
  if (Platform.OS !== 'web') return null;
  return (
    <View
      style={webRefreshPillStyle}
      accessibilityRole="progressbar"
      accessibilityLabel="Refreshing">
      <View {...({ dataSet: { signalWebRefreshSpinner: 'true' } } as object)} />
    </View>
  );
}

/** 스크롤 viewport 위에 띄워 리스트 높이 변화 없이 PTR 상태를 표시한다. */
export function WebRefreshOverlay({ visible }: { visible: boolean }) {
  if (Platform.OS !== 'web' || !visible) return null;
  return (
    <View pointerEvents="none" style={webRefreshOverlayStyle}>
      <WebRefreshStatus />
    </View>
  );
}

export function useWebRefreshHandlers(
  refreshControlProps: WebRefreshControlProps,
  getNode: (event?: unknown) => HTMLElement | null,
) {
  const enabled = Platform.OS === 'web';
  const refreshRef = useRef(refreshControlProps);
  refreshRef.current = refreshControlProps;
  const touchStartYRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef(false);
  const wheelPullDistanceRef = useRef(0);
  const lastRefreshAtRef = useRef(0);

  const triggerRefresh = useCallback(
    (node: HTMLElement | null) => {
      if (!enabled) return;
      if (!node || node.scrollTop > 2) return;

      const props = refreshRef.current;
      if (!props?.onRefresh || props.refreshing || props.enabled === false) return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < WEB_REFRESH_COOLDOWN_MS) return;
      lastRefreshAtRef.current = now;
      props.onRefresh();
    },
    [enabled],
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
        return;
      }
      touchStartYRef.current = getTouchY(event);
      touchTriggeredRef.current = false;
    },
    [enabled, getNode, getTouchY],
  );

  const onTouchMove = useCallback(
    (event: unknown) => {
      const startY = touchStartYRef.current;
      if (!enabled) return;
      if (startY == null || touchTriggeredRef.current) return;
      const y = getTouchY(event);
      if (y == null || y - startY < 72) return;
      touchTriggeredRef.current = true;
      triggerRefresh(getNode(event));
    },
    [enabled, getNode, getTouchY, triggerRefresh],
  );

  const onTouchEnd = useCallback(() => {
    touchStartYRef.current = null;
    touchTriggeredRef.current = false;
    wheelPullDistanceRef.current = 0;
  }, []);

  const onWheel = useCallback(
    (event: unknown) => {
      const node = getNode(event);
      if (!enabled) return;
      if (!node || node.scrollTop > 2) {
        wheelPullDistanceRef.current = 0;
        return;
      }
      const deltaY = (event as WebEvent)?.nativeEvent?.deltaY ?? (event as WebEvent)?.deltaY ?? 0;
      if (deltaY >= 0) {
        wheelPullDistanceRef.current = 0;
        return;
      }
      wheelPullDistanceRef.current += Math.abs(deltaY);
      if (wheelPullDistanceRef.current < 110) return;
      wheelPullDistanceRef.current = 0;
      triggerRefresh(node);
    },
    [enabled, getNode, triggerRefresh],
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };
}

const webRefreshPillStyle = {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: WEB_SIGNAL_CSS.card,
  borderWidth: 1,
  borderColor: WEB_SIGNAL_CSS.border,
  boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
} as const;

const webRefreshOverlayStyle = {
  position: 'absolute',
  top: 10,
  left: 0,
  right: 0,
  zIndex: 30,
  alignItems: 'center',
  pointerEvents: 'none',
} as const;
