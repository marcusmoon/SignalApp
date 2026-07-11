import { useEffect, type RefObject } from 'react';
import { Platform, type ScrollView } from 'react-native';

function getScrollableNode(scrollRef: RefObject<ScrollView | null>): HTMLElement | null {
  const scrollView = scrollRef.current;
  if (!scrollView || typeof scrollView.getScrollableNode !== 'function') return null;
  return scrollView.getScrollableNode() as HTMLElement | null;
}

/** Map wheel deltas to free horizontal scroll on web (no page snapping). */
export function useWebHorizontalWheelScroll(
  scrollRef: RefObject<ScrollView | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const node = getScrollableNode(scrollRef);
    if (!node || typeof node.addEventListener !== 'function') return;

    const onWheel = (ev: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;

      const delta =
        Math.abs(ev.deltaX) > Math.abs(ev.deltaY)
          ? ev.deltaX
          : ev.shiftKey
            ? ev.deltaY
            : ev.deltaY;
      if (delta === 0) return;

      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
      if ((delta < 0 && atStart) || (delta > 0 && atEnd)) return;

      ev.preventDefault();
      node.scrollLeft += delta;
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [scrollRef, enabled]);
}
