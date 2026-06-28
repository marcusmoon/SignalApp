import { useEffect, type RefObject } from 'react';
import { Platform, type ScrollView } from 'react-native';

/** Map vertical wheel to horizontal scroll on web (Shift+wheel or trackpad horizontal delta). */
export function useWebHorizontalWheelScroll(
  scrollRef: RefObject<ScrollView | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const scrollView = scrollRef.current;
    if (!scrollView) return;

    const node =
      typeof scrollView.getScrollableNode === 'function'
        ? (scrollView.getScrollableNode() as HTMLElement | null)
        : null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const onWheel = (ev: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;

      const horizontalDelta = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.shiftKey ? ev.deltaY : 0;
      if (horizontalDelta === 0) return;

      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
      if ((horizontalDelta < 0 && atStart) || (horizontalDelta > 0 && atEnd)) return;

      ev.preventDefault();
      node.scrollLeft += horizontalDelta;
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [scrollRef, enabled]);
}
