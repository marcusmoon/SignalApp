import { isValidElement, useCallback, useRef } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

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

export function getWebRefreshControlProps(refreshControl: unknown): WebRefreshControlProps {
  return isValidElement(refreshControl)
    ? (refreshControl.props as Exclude<WebRefreshControlProps, null>)
    : null;
}

export function WebRefreshStatus() {
  if (Platform.OS !== 'web') return null;
  return (
    <View style={webRefreshStatusStyle}>
      <ActivityIndicator size="small" color={WEB_SIGNAL_CSS.green as never} />
    </View>
  );
}

export function useWebRefreshHandlers(
  refreshControlProps: WebRefreshControlProps,
  getNode: (event?: unknown) => HTMLElement | null,
) {
  const enabled = Platform.OS === 'web';
  const touchStartYRef = useRef<number | null>(null);
  const touchTriggeredRef = useRef(false);
  const wheelPullDistanceRef = useRef(0);

  const triggerRefresh = useCallback(
    (node: HTMLElement | null) => {
      if (!enabled) return;
      if (!node || node.scrollTop > 2) return;
      if (!refreshControlProps?.onRefresh || refreshControlProps.refreshing || refreshControlProps.enabled === false) return;
      refreshControlProps.onRefresh();
    },
    [enabled, refreshControlProps],
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

const webRefreshStatusStyle = {
  position: 'sticky',
  top: 8,
  zIndex: 20,
  alignSelf: 'center',
  width: 36,
  height: 36,
  marginTop: 8,
  marginBottom: 8,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: WEB_SIGNAL_CSS.card,
  borderWidth: 1,
  borderColor: WEB_SIGNAL_CSS.border,
  boxShadow: '0 8px 20px rgba(0,0,0,0.14)',
} as const;
