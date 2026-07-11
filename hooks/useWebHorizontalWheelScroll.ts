import { useEffect, type RefObject } from 'react';
import { Platform, type ScrollView } from 'react-native';

function getScrollableNode(scrollRef: RefObject<ScrollView | null>): HTMLElement | null {
  const scrollView = scrollRef.current;
  if (!scrollView || typeof scrollView.getScrollableNode !== 'function') return null;
  return scrollView.getScrollableNode() as HTMLElement | null;
}

function snapScrollLeft(node: HTMLElement, pageWidth: number, animated: boolean) {
  if (pageWidth <= 0) return;
  const maxIndex = Math.max(0, Math.round((node.scrollWidth - node.clientWidth) / pageWidth));
  const index = Math.max(0, Math.min(Math.round(node.scrollLeft / pageWidth), maxIndex));
  node.scrollTo({ left: index * pageWidth, behavior: animated ? 'smooth' : 'auto' });
}

/** Map wheel to horizontal scroll on web; optional page snap after gesture ends. */
export function useWebHorizontalWheelScroll(
  scrollRef: RefObject<ScrollView | null>,
  enabled: boolean,
  pageWidth = 0,
) {
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;

    const node = getScrollableNode(scrollRef);
    if (!node || typeof node.addEventListener !== 'function') return;

    let wheelSnapTimer: ReturnType<typeof setTimeout> | null = null;
    let pointerActive = false;

    const clearWheelSnapTimer = () => {
      if (!wheelSnapTimer) return;
      clearTimeout(wheelSnapTimer);
      wheelSnapTimer = null;
    };

    const scheduleWheelSnap = () => {
      if (pageWidth <= 0 || pointerActive) return;
      clearWheelSnapTimer();
      wheelSnapTimer = setTimeout(() => {
        snapScrollLeft(node, pageWidth, true);
        wheelSnapTimer = null;
      }, 120);
    };

    const onWheel = (ev: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;

      const horizontalDelta =
        Math.abs(ev.deltaX) > Math.abs(ev.deltaY) ? ev.deltaX : ev.shiftKey ? ev.deltaY : 0;
      if (horizontalDelta === 0) return;

      const atStart = node.scrollLeft <= 0;
      const atEnd = node.scrollLeft + node.clientWidth >= node.scrollWidth - 1;
      if ((horizontalDelta < 0 && atStart) || (horizontalDelta > 0 && atEnd)) return;

      ev.preventDefault();
      node.scrollLeft += horizontalDelta;
      scheduleWheelSnap();
    };

    const onPointerDown = () => {
      pointerActive = true;
      clearWheelSnapTimer();
    };

    const onPointerUp = () => {
      pointerActive = false;
      if (pageWidth > 0) {
        snapScrollLeft(node, pageWidth, true);
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onPointerDown, { passive: true });
    node.addEventListener('pointerup', onPointerUp, { passive: true });
    node.addEventListener('pointercancel', onPointerUp, { passive: true });

    return () => {
      clearWheelSnapTimer();
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerUp);
    };
  }, [scrollRef, enabled, pageWidth]);
}

export function snapWebCarouselToOffset(
  scrollRef: RefObject<ScrollView | null>,
  offsetX: number,
  pageWidth: number,
  animated: boolean,
) {
  if (Platform.OS !== 'web' || pageWidth <= 0) return offsetX;
  const node = getScrollableNode(scrollRef);
  if (!node) return offsetX;

  const maxIndex = Math.max(0, Math.round((node.scrollWidth - node.clientWidth) / pageWidth));
  const index = Math.max(0, Math.min(Math.round(offsetX / pageWidth), maxIndex));
  const targetX = index * pageWidth;
  node.scrollTo({ left: targetX, behavior: animated ? 'smooth' : 'auto' });
  return targetX;
}
