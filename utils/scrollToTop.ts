import type { RefObject } from 'react';

export type ScrollToTopTarget = {
  getScrollableNode?: () => HTMLElement | null;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
} | null;

export function scrollToTop(ref: RefObject<ScrollToTopTarget>, animated = false) {
  const instance = ref.current;
  if (!instance) return;

  if (typeof instance.scrollToOffset === 'function') {
    instance.scrollToOffset({ offset: 0, animated });
    return;
  }

  if (typeof instance.scrollTo === 'function') {
    instance.scrollTo({ y: 0, animated });
    return;
  }

  const node = instance.getScrollableNode?.();
  if (node) {
    node.scrollTo({ top: 0, behavior: animated ? 'smooth' : 'auto' });
  }
}
