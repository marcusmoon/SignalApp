import type { RefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';

export type ScrollToTopTarget = {
  getScrollableNode?: () => unknown;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToIndex?: (opts: { index: number; animated?: boolean; viewOffset?: number }) => void;
} | null;

function isDomScrollNode(node: unknown): node is HTMLElement {
  return typeof node === 'object' && node !== null && 'scrollTop' in node;
}

function scrollDomNode(node: HTMLElement, offset: number, animated: boolean) {
  if (animated) {
    node.scrollTo({ top: offset, behavior: 'smooth' });
    return;
  }
  node.scrollTop = offset;
}

function scrollInstanceOnce(instance: NonNullable<ScrollToTopTarget>, animated: boolean) {
  if (typeof instance.scrollToOffset === 'function') {
    instance.scrollToOffset({ offset: 0, animated });
  } else if (typeof instance.scrollTo === 'function') {
    instance.scrollTo({ y: 0, animated });
  }

  if (typeof instance.scrollToIndex === 'function') {
    try {
      instance.scrollToIndex({ index: 0, animated, viewOffset: 0 });
    } catch {
      // List may be empty or not measured yet.
    }
  }

  if (Platform.OS !== 'web') return;

  const node = instance.getScrollableNode?.();
  if (isDomScrollNode(node)) scrollDomNode(node, 0, animated);
}

/** Lazy web scroll API: resolves the DOM node when scroll is invoked, not only at ref attach. */
export function createLazyWebScrollApi(
  getViewRef: () => { getScrollableNode?: () => unknown } | null,
): NonNullable<ScrollToTopTarget> {
  const resolveNode = () => {
    const node = getViewRef()?.getScrollableNode?.() ?? null;
    return isDomScrollNode(node) ? node : null;
  };
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
  scrollInstanceOnce(instance, animated);
}

/** Retry scroll after layout / data updates (refresh FAB, filter change). */
export function scrollToTopWithRetry(ref: RefObject<ScrollToTopTarget>, animated = false) {
  const run = () => scrollToTop(ref, animated);
  run();
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(run);
  }
  setTimeout(run, 0);
  setTimeout(run, 50);
  setTimeout(run, 150);
  if (Platform.OS !== 'web') {
    InteractionManager.runAfterInteractions(run);
  }
}
