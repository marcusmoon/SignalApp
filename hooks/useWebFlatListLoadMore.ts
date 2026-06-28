import { useCallback, useRef, type RefObject } from 'react';
import { Platform, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { createScrollLoadMoreGate } from '@/utils/listScrollLoadMoreGate';

type WebFlatListLoadMoreOptions = {
  hasMore: boolean;
  loadingMore: boolean;
  loading: boolean;
  enabled?: boolean;
  loadMore: () => void | Promise<void>;
  /** Sync guard — set true before async work in loadMore (refs beat React state). */
  isBusyRef?: RefObject<boolean>;
  fillPadPx?: number;
  autoFillCooldownMs?: number;
  scrollNearEndCooldownMs?: number;
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
  isBusyRef,
  fillPadPx = 32,
  autoFillCooldownMs = 2000,
  scrollNearEndCooldownMs = 900,
}: WebFlatListLoadMoreOptions) {
  const viewportH = useRef(0);
  const lastContentH = useRef(0);
  const lastAutoFillAt = useRef(0);
  const scrollGateRef = useRef(createScrollLoadMoreGate(undefined, scrollNearEndCooldownMs));
  const stateRef = useRef({
    hasMore,
    loadingMore,
    loading,
    enabled,
    loadMore,
    isBusyRef,
    fillPadPx,
    autoFillCooldownMs,
  });
  stateRef.current = {
    hasMore,
    loadingMore,
    loading,
    enabled,
    loadMore,
    isBusyRef,
    fillPadPx,
    autoFillCooldownMs,
  };

  const isLoadBlocked = () => {
    const s = stateRef.current;
    return !s.enabled || !s.hasMore || s.loadingMore || s.loading || s.isBusyRef?.current === true;
  };

  const tryAutoFill = useCallback((contentH: number) => {
    if (Platform.OS !== 'web') return;
    if (isLoadBlocked()) return;
    const s = stateRef.current;
    const vh = viewportH.current;
    if (vh <= 0 || contentH <= 0) return;
    if (contentH >= vh + s.fillPadPx) return;

    const now = Date.now();
    if (contentH === lastContentH.current && now - lastAutoFillAt.current < s.autoFillCooldownMs) {
      return;
    }
    lastContentH.current = contentH;
    lastAutoFillAt.current = now;
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
    if (isLoadBlocked()) return;
    const s = stateRef.current;
    scrollGateRef.current.onScrollNearEnd(e, {
      enabled: true,
      trigger: () => {
        if (isLoadBlocked()) return;
        void s.loadMore();
      },
    });
  }, []);

  return { onLayout, onContentSizeChange, onScroll };
}
