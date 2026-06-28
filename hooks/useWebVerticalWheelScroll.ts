import { useEffect, type RefObject } from 'react';
import { Platform } from 'react-native';

type ScrollableRef = RefObject<{
  getScrollableNode?: () => HTMLElement;
} | null>;

/**
 * RN Web: wheel over list rows targets non-scrollable children, so FlatList/ScrollView
 * does not scroll. Forward vertical wheel to the scroll container (capture phase).
 */
export function useWebVerticalWheelScroll(scrollRef: ScrollableRef, enabled = true) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    let node: HTMLElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (ev: WheelEvent) => {
      if (!node) return;
      if (node.scrollHeight <= node.clientHeight + 1) return;

      const deltaY = ev.deltaY;
      if (deltaY === 0) return;
      if (Math.abs(ev.deltaX) > Math.abs(deltaY)) return;

      const atTop = node.scrollTop <= 0;
      const atBottom = node.scrollTop + node.clientHeight >= node.scrollHeight - 1;
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) return;

      ev.preventDefault();
      node.scrollTop += deltaY;
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
  }, [scrollRef, enabled]);
}
