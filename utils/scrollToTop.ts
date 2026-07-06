import type { RefObject } from 'react';

export type ScrollToTopTarget = {
  getScrollableNode?: () => HTMLElement | null;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
} | null;

function scrollDomNode(node: HTMLElement, offset: number, animated: boolean) {
  if (animated) {
    node.scrollTo({ top: offset, behavior: 'smooth' });
    return;
  }
  node.scrollTop = offset;
}

/** Lazy web scroll API: resolves the DOM node when scroll is invoked, not only at ref attach. */
export function createLazyWebScrollApi(
  getViewRef: () => { getScrollableNode?: () => HTMLElement | null } | null,
): NonNullable<ScrollToTopTarget> {
  const resolveNode = () => getViewRef()?.getScrollableNode?.() ?? null;
  return {
    getScrollableNode: resolveNode,
    scrollToOffset: ({ offset, animated = false }) => {
      const node = resolveNode();
      if (node) scrollDomNode(node, offset, animated);
    },
    scrollTo: ({ y = 0, animated = false }) => {
      const node = resolveNode();
      if (node) scrollDomNode(node, y, animated);
    },
  };
}

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
  if (node) scrollDomNode(node, 0, animated);
}
