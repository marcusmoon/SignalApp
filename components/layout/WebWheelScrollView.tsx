import { forwardRef, useCallback, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import {
  getWebRefreshControlProps,
  useWebRefreshHandlers,
  WebRefreshStatus,
} from '@/components/layout/webRefreshControl';
import { WEB_THEME_BG } from '@/constants/webLayout';
import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

export const WebWheelScrollView = forwardRef<ScrollView, ScrollViewProps>(function WebWheelScrollView(
  { children, contentContainerStyle, onScroll, refreshControl: _refreshControl, style, ...rest },
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);
  useWebVerticalWheelScroll(localRef, { onScroll });
  const refreshControlProps = getWebRefreshControlProps(_refreshControl);
  const getNode = useCallback((event?: unknown) => (
    (event as { currentTarget?: HTMLElement | null } | undefined)?.currentTarget
    ?? (localRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)?.getScrollableNode?.()
    ?? null
  ), []);
  const webRefreshHandlers = useWebRefreshHandlers(refreshControlProps, getNode);

  if (Platform.OS === 'web') {
    const flatStyle = StyleSheet.flatten([{ backgroundColor: WEB_THEME_BG }, style]);
    const backgroundColor = flatStyle?.backgroundColor ?? WEB_THEME_BG;
    const webEventProps = {
      onTouchStart: webRefreshHandlers.onTouchStart,
      onTouchMove: webRefreshHandlers.onTouchMove,
      onTouchEnd: webRefreshHandlers.onTouchEnd,
      onWheel: webRefreshHandlers.onWheel,
    };
    return (
      <View
        {...(rest as object)}
        ref={localRef as never}
        {...(webEventProps as Record<string, unknown>)}
        style={[webViewportStyle, { backgroundColor }, style]}>
        <View
          style={[
            contentContainerStyle,
            { backgroundColor, flexGrow: 1, minHeight: '100%' as const },
          ]}>
          {refreshControlProps?.refreshing ? <WebRefreshStatus /> : null}
          {children}
        </View>
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
    >
      {children}
    </ScrollView>
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
