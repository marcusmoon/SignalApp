import { forwardRef, useRef } from 'react';
import { Platform, ScrollView, View, type ScrollViewProps } from 'react-native';

import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

export const WebWheelScrollView = forwardRef<ScrollView, ScrollViewProps>(function WebWheelScrollView(
  { children, contentContainerStyle, onScroll, refreshControl: _refreshControl, style, ...rest },
  forwardedRef,
) {
  const localRef = useRef<ScrollView>(null);
  useWebVerticalWheelScroll(localRef, { onScroll });

  if (Platform.OS === 'web') {
    return (
      <View
        {...(rest as object)}
        ref={localRef as never}
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
