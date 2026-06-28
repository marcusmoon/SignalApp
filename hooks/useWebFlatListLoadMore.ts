import { useCallback, useRef } from 'react';
import { Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';

type WebFlatListLoadMoreOptions = {
  hasMore: boolean;
  loadingMore: boolean;
  loading: boolean;
  enabled?: boolean;
  loadMore: () => void | Promise<void>;
  fillPadPx?: number;
};

/**
 * Web FlatList pagination helpers: near-end scroll gate + auto-fill when content is shorter than viewport.
 * Uses refs so wheel-forwarded onEndReached never reads stale hasMore/offset state.
 */
export function useWebFlatListLoadMore({
  hasMore,
  loadingMore,
  loading,
  enabled = true,
  loadMore,
  fillPadPx = 32,
}: WebFlatListLoadMoreOptions) {
  const viewportH = useRef(0);
  const scrollGateRef = useRef(createScrollLoadMoreGate());
  const stateRef = useRef({ hasMore, loadingMore, loading, enabled, loadMore, fillPadPx });
  stateRef.current = { hasMore, loadingMore, loading, enabled, loadMore, fillPadPx };

  const tryAutoFill = useCallback((contentH: number) => {
    if (Platform.OS !== 'web') return;
    const s = stateRef.current;
    if (!s.enabled || !s.hasMore || s.loadingMore || s.loading) return;
    const vh = viewportH.current;
    if (vh <= 0 || contentH <= 0) return;
    if (contentH >= vh + s.fillPadPx) return;
    void s.loadMore();
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    if (Platform.OS !== 'web') return;
    viewportH.current = e.nativeEvent.layout.height;
  }, []);

  const onContentSizeChange = useCallback(
    (_w: number, h: number) => {
      tryAutoFill(h);
    },
    [tryAutoFill],
  );

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const s = stateRef.current;
    scrollGateRef.current.onScrollNearEnd(e, {
      enabled: s.enabled && s.hasMore && !s.loadingMore && !s.loading,
      trigger: () => void s.loadMore(),
    });
  }, []);

  return { onLayout, onContentSizeChange, onScroll };
}
