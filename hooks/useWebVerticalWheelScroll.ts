import { useEffect, useRef, type RefObject } from 'react';
import { Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import {
  isDomNearScrollEnd,
  syntheticScrollEventFromDom,
} from '@/utils/listScrollLoadMoreGate';
import { resolveWebDomNode } from '@/utils/webDomNode';
import { scrollWebScrollableToY } from '@/utils/webWheelScroll';

type ScrollableRef = RefObject<{
  getScrollableNode?: () => HTMLElement;
  getScrollRef?: () => { scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void };
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
} | null>;

type WebVerticalWheelScrollOptions = {
  enabled?: boolean;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onEndReached?: () => void;
  nearEndPadPx?: number;
  nearEndCooldownMs?: number;
};

/**
 * RN Web: wheel over list rows targets non-scrollable children, so FlatList/ScrollView
 * does not scroll. Forward vertical wheel through RN scroll APIs so VirtualizedList
 * metrics stay in sync (required for pagination / onEndReached).
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
      const instance = scrollRef.current;
      if (!instance || !node) return;

      const deltaY = ev.deltaY;
      if (deltaY === 0) return;
      if (Math.abs(ev.deltaX) > Math.abs(deltaY)) return;

      const canScroll = node.scrollHeight > node.clientHeight + 1;

      if (!canScroll) {
        if (deltaY > 0) notifyScroll();
        return;
      }

      const atTop = node.scrollTop <= 0;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      if (deltaY < 0 && atTop) return;

      ev.preventDefault();

      if (deltaY > 0 && atBottom) {
        notifyScroll();
        return;
      }

      scrollWebScrollableToY(instance, node, node.scrollTop + deltaY);
      notifyScroll();
    };

    const attach = () => {
      // RN Web View refs are the DOM node; ScrollView/FlatList use getScrollableNode.
      node = resolveWebDomNode(scrollRef.current);
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
