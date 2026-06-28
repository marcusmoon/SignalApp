import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import {
  dispatchDomScrollEvent,
  isDomNearScrollEnd,
  syntheticScrollEventFromDom,
} from '@/utils/listScrollLoadMoreGate';

type ScrollableRef = RefObject<{
  getScrollableNode?: () => HTMLElement;
} | null>;

type WebVerticalWheelScrollOptions = {
  enabled?: boolean;
  /** FlatList/ScrollView onScroll — not fired when we set scrollTop manually on web. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** FlatList onEndReached — same gap after manual wheel scroll. */
  onEndReached?: () => void;
  nearEndPadPx?: number;
  nearEndCooldownMs?: number;
};

/**
 * RN Web: wheel over list rows targets non-scrollable children, so FlatList/ScrollView
 * does not scroll. Forward vertical wheel to the scroll container (capture phase).
 */
export function useWebVerticalWheelScroll(
  scrollRef: ScrollableRef,
  options: WebVerticalWheelScrollOptions = {},
) {
  const {
    enabled = true,
    onScroll,
    onEndReached,
    nearEndPadPx = 240,
    nearEndCooldownMs = 400,
  } = options;

  const onScrollRef = useRef(onScroll);
  const onEndReachedRef = useRef(onEndReached);
  onScrollRef.current = onScroll;
  onEndReachedRef.current = onEndReached;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    let node: HTMLElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let lastNearEnd = 0;

    const notifyScroll = () => {
      if (!node) return;
      dispatchDomScrollEvent(node);
      onScrollRef.current?.(syntheticScrollEventFromDom(node));
      if (
        onEndReachedRef.current &&
        isDomNearScrollEnd(node, nearEndPadPx) &&
        Date.now() - lastNearEnd >= nearEndCooldownMs
      ) {
        lastNearEnd = Date.now();
        onEndReachedRef.current();
      }
    };

    const onWheel = (ev: WheelEvent) => {
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + 1) return;

      const deltaY = ev.deltaY;
      if (deltaY === 0) return;
      if (Math.abs(ev.deltaX) > Math.abs(deltaY)) return;

      const atTop = node.scrollTop <= 0;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      if (deltaY < 0 && atTop) return;
      if (deltaY > 0 && atBottom) {
        notifyScroll();
        return;
      }

      ev.preventDefault();
      node.scrollTop += deltaY;
      notifyScroll();
    };

    const attach = () => {
      const scrollView = scrollRef.current;
      if (!scrollView?.getScrollableNode) {
        retryTimer = setTimeout(attach, 50);
        return;
      }
      node = scrollView.getScrollableNode() as HTMLElement | null;
      if (!node) {
        retryTimer = setTimeout(attach, 50);
        return;
      }
      node.addEventListener('wheel', onWheel, { passive: false, capture: true });
    };

    attach();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (node) node.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [scrollRef, enabled, nearEndPadPx, nearEndCooldownMs]);
}
