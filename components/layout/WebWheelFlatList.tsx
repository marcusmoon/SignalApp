import { forwardRef, useEffect, useRef } from 'react';
import { FlatList, Platform, type FlatListProps, type LayoutChangeEvent } from 'react-native';

import { useWebVerticalWheelScroll } from '@/hooks/useWebVerticalWheelScroll';

function WebWheelFlatListInner<T>(
  { onScroll, onEndReached, onLayout, ...rest }: FlatListProps<T>,
  forwardedRef: React.Ref<FlatList<T>>,
) {
  const localRef = useRef<FlatList<T>>(null);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useWebVerticalWheelScroll(localRef, {
    onScroll,
  });

  /** Sidebar pane toggles can skip RN onLayout — observe the scroll node directly on web. */
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    let node: HTMLElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let observer: ResizeObserver | null = null;

    const attach = () => {
      node = localRef.current?.getScrollableNode?.() as HTMLElement | null;
      if (!node) {
        retryTimer = setTimeout(attach, 50);
        return;
      }
      observer = new ResizeObserver(() => {
        if (!node || node.clientHeight <= 0) return;
        onLayoutRef.current?.({
          nativeEvent: {
            layout: { height: node.clientHeight, width: node.clientWidth, x: 0, y: 0 },
          },
        } as LayoutChangeEvent);
      });
      observer.observe(node);
    };

    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      observer?.disconnect();
    };
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    onLayout?.(e);
  };

  return (
    <FlatList
      {...rest}
      onScroll={onScroll}
      onEndReached={onEndReached}
      onLayout={handleLayout}
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
}

export const WebWheelFlatList = forwardRef(WebWheelFlatListInner) as <T>(
  props: FlatListProps<T> & { ref?: React.Ref<FlatList<T>> },
) => React.ReactElement | null;
