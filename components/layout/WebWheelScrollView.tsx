import { forwardRef, isValidElement, useRef } from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';

import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

export const WebWheelScrollView = forwardRef<ScrollView, ScrollViewProps>(function WebWheelScrollView(
  { children, contentContainerStyle, onScroll, refreshControl: _refreshControl, style, ...rest },
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);
  const webRefreshStartYRef = useRef<number | null>(null);
  const webRefreshTriggeredRef = useRef(false);
  const webWheelPullDistanceRef = useRef(0);
  useWebVerticalWheelScroll(localRef, { onScroll });
  const refreshControlProps = isValidElement(_refreshControl)
    ? (_refreshControl.props as { enabled?: boolean; refreshing?: boolean; onRefresh?: () => void })
    : null;

  if (Platform.OS === 'web') {
    const getNode = (event?: unknown) =>
      (event as { currentTarget?: HTMLElement | null } | undefined)?.currentTarget
      ?? (localRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.()
      ?? null;
    const triggerRefresh = (node: HTMLElement | null) => {
      if (!node || node.scrollTop > 2) return;
      if (!refreshControlProps?.onRefresh || refreshControlProps.refreshing || refreshControlProps.enabled === false) return;
      refreshControlProps.onRefresh();
    };
    const getTouchY = (event: unknown) => {
      const nativeEvent = (event as { nativeEvent?: { touches?: Array<{ clientY?: number; pageY?: number }> } })
        ?.nativeEvent;
      const touch = nativeEvent?.touches?.[0];
      return touch?.clientY ?? touch?.pageY ?? null;
    };
    const handleTouchStart = (event: unknown) => {
      const node = getNode(event);
      if (!node || node.scrollTop > 2) {
        webRefreshStartYRef.current = null;
        return;
      }
      webRefreshStartYRef.current = getTouchY(event);
      webRefreshTriggeredRef.current = false;
    };
    const handleTouchMove = (event: unknown) => {
      const startY = webRefreshStartYRef.current;
      if (startY == null || webRefreshTriggeredRef.current) return;
      const y = getTouchY(event);
      if (y == null || y - startY < 72) return;
      webRefreshTriggeredRef.current = true;
      triggerRefresh(getNode(event));
    };
    const handleTouchEnd = () => {
      webRefreshStartYRef.current = null;
      webRefreshTriggeredRef.current = false;
    };
    const handleWheel = (event: unknown) => {
      const node = getNode(event);
      if (!node || node.scrollTop > 2) {
        webWheelPullDistanceRef.current = 0;
        return;
      }
      const deltaY = (event as { nativeEvent?: { deltaY?: number }; deltaY?: number })?.nativeEvent?.deltaY
        ?? (event as { deltaY?: number })?.deltaY
        ?? 0;
      if (deltaY >= 0) {
        webWheelPullDistanceRef.current = 0;
        return;
      }
      webWheelPullDistanceRef.current += Math.abs(deltaY);
      if (webWheelPullDistanceRef.current < 110) return;
      webWheelPullDistanceRef.current = 0;
      triggerRefresh(node);
    };
    const webEventProps = {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onWheel: handleWheel,
    };
    return (
      <View
        {...(rest as object)}
        ref={localRef as never}
        {...(webEventProps as Record<string, unknown>)}
        style={[webViewportStyle, style]}>
        <View style={contentContainerStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      {...rest}
      contentContainerStyle={contentContainerStyle}
      onScroll={onScroll}
      refreshControl={_refreshControl}
      style={style}
      ref={(instance) => {
        localRef.current = instance;
        if (typeof forwardedRef === 'function') {
          forwardedRef(instance);
        } else if (forwardedRef) {
          forwardedRef.current = instance;
        }
      }}
    />
  );
});

const webViewportStyle = {
  flex: 1,
  minHeight: 0,
  height: '100%',
  maxHeight: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
} as const;
