import { forwardRef, useCallback, useRef, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { WEB_THEME_BG, webScrollViewportDataSet } from '@/constants/webLayout';
import { useWebScrollResetOnKey } from '@/hooks/useWebScrollResetOnKey';
import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';
import { createLazyWebScrollApi } from '@/utils/scrollToTop';

type WebWheelScrollViewProps = ScrollViewProps & {
  scrollResetKey?: string | number | null;
  contentRevision?: unknown;
  children?: ReactNode;
};

export const WebWheelScrollView = forwardRef<ScrollView, WebWheelScrollViewProps>(function WebWheelScrollView(
  {
    children,
    contentContainerStyle,
    onScroll,
    refreshControl,
    scrollResetKey,
    contentRevision,
    style,
    ...rest
  },
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);
  useWebVerticalWheelScroll(localRef, { onScroll });

  const getWebScrollNode = useCallback(
    () =>
      (localRef.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
        ?.getScrollableNode?.() ?? null,
    [],
  );
  useWebScrollResetOnKey(getWebScrollNode, scrollResetKey, contentRevision ?? children);

  if (Platform.OS === 'web') {
    const flatStyle = StyleSheet.flatten([{ backgroundColor: WEB_THEME_BG }, style]);
    const backgroundColor = flatStyle?.backgroundColor ?? WEB_THEME_BG;
    const webViewportProps = webScrollViewportDataSet
      ? ({ dataSet: webScrollViewportDataSet } as unknown as Record<string, unknown>)
      : undefined;
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
    const webScrollKey = scrollResetKey != null ? `wws-${scrollResetKey}` : undefined;

    return (
      <View
        key={webScrollKey}
        {...(rest as object)}
        {...webViewportProps}
        ref={setWebRef}
        style={[webViewportStyle, { backgroundColor }, style]}>
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
      refreshControl={refreshControl}
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
  flexGrow: 1,
  flexShrink: 1,
  flexBasis: 0,
  minHeight: 0,
  maxHeight: '100%',
  overflowY: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch',
} as const;
