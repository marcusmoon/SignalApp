import { forwardRef, useCallback, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import {
  getWebRefreshControlProps,
  useWebRefreshHandlers,
  WebRefreshOverlay,
} from '@/components/layout/webRefreshControl';
import { WEB_THEME_BG } from '@/constants/webLayout';
import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';
import { createLazyWebScrollApi } from '@/utils/scrollToTop';

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
    const setWebRef = (instance: View | null) => {
      localRef.current = instance as never;
      const api = createLazyWebScrollApi(
        () => localRef.current as { getScrollableNode?: () => HTMLElement | null } | null,
      ) as unknown as ScrollView;

      if (typeof forwardedRef === 'function') {
        forwardedRef(api);
      } else if (forwardedRef) {
        forwardedRef.current = api;
      }
    };
    return (
      <View
        {...(rest as object)}
        ref={setWebRef}
        {...(webEventProps as Record<string, unknown>)}
        style={[webViewportStyle, { backgroundColor }, style]}>
        <WebRefreshOverlay visible={!!refreshControlProps?.refreshing} />
        <View
          style={[
            contentContainerStyle,
            { backgroundColor, flexGrow: 1, minHeight: '100%' as const },
          ]}>
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
  position: 'relative',
  flex: 1,
  minHeight: 0,
  height: '100%',
  maxHeight: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
} as const;
