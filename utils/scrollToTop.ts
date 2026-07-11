import type { RefObject } from 'react';
import { InteractionManager, Platform } from 'react-native';

export type ScrollToTopTarget = {
  getScrollableNode?: () => unknown;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
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

/**
 * Scroll to offset 0 so ListHeaderComponent (digest, filters) stays visible.
 * Do not use scrollToIndex(0) — it jumps past the header to the first data row.
 */
function scrollInstanceOnce(instance: NonNullable<ScrollToTopTarget>, animated: boolean) {
  if (typeof instance.scrollToOffset === 'function') {
    instance.scrollToOffset({ offset: 0, animated });
    return;
  }

  if (typeof instance.scrollTo === 'function') {
    instance.scrollTo({ y: 0, animated });
    return;
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

const WEB_SCROLL_RETRY_MS = [0, 50, 150, 300, 500, 800, 1200];
const NATIVE_SCROLL_RETRY_MS = [0, 50, 150, 300];

/** Retry scroll after layout / data updates (refresh FAB, filter change). */
export function scrollToTopWithRetry(ref: RefObject<ScrollToTopTarget>, animated = false) {
  const run = () => scrollToTop(ref, animated);
  const delays = Platform.OS === 'web' ? WEB_SCROLL_RETRY_MS : NATIVE_SCROLL_RETRY_MS;
  for (const delay of delays) {
    if (delay === 0) {
      run();
    } else {
      setTimeout(run, delay);
    }
  }
  if (Platform.OS !== 'web') {
    InteractionManager.runAfterInteractions(run);
  }
}

/** Web DOM scroll keeps position when list data swaps — poll until top after filter changes. */
export function enforceScrollToTopOnWeb(
  ref: RefObject<ScrollToTopTarget>,
  isActive: () => boolean,
  animated = false,
) {
  if (Platform.OS !== 'web') return;

  let attempts = 0;
  const maxAttempts = 120;

  const tick = () => {
    if (!isActive()) return;
    scrollToTop(ref, animated);
    const node = ref.current?.getScrollableNode?.();
    if (isDomScrollNode(node) && node.scrollTop <= 1) return;
    attempts += 1;
    if (attempts < maxAttempts) {
      requestAnimationFrame(tick);
    }
  };

  scrollToTopWithRetry(ref, animated);
  requestAnimationFrame(tick);
}
