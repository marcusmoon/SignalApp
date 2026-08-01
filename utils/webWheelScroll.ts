type ScrollableLike = {
  getScrollRef?: () => { scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void };
  scrollTo?: (opts: { x?: number; y?: number; animated?: boolean }) => void;
  scrollToOffset?: (opts: { offset: number; animated?: boolean }) => void;
};

type ScrollMetrics = {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
};

/** Duck-type DOM element (avoids @/ import so Node tests can load this module). */
function isDomScrollRef(value: unknown): boolean {
  if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) return true;
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { nodeType?: unknown }).nodeType === 1
  );
}

/**
 * Apply a vertical scroll offset for web wheel forwarding.
 *
 * RN Web `View` refs are HTMLElements. Calling native `Element.scrollTo({ y, animated })`
 * is a no-op (browser expects `{ top, behavior }`), which freezes scroll after
 * `preventDefault` on wheel.
 */
export function scrollWebScrollableToY(
  instance: ScrollableLike,
  node: ScrollMetrics,
  y: number,
): number {
  const maxY = Math.max(0, node.scrollHeight - node.clientHeight);
  const nextY = Math.max(0, Math.min(maxY, y));

  if (typeof instance.scrollToOffset === 'function') {
    instance.scrollToOffset({ offset: nextY, animated: false });
    return nextY;
  }

  if (isDomScrollRef(instance) || instance === (node as unknown)) {
    node.scrollTop = nextY;
    return nextY;
  }

  const scrollRef = instance.getScrollRef?.() ?? instance;
  if (typeof scrollRef.scrollTo === 'function' && !isDomScrollRef(scrollRef)) {
    scrollRef.scrollTo({ y: nextY, animated: false });
    return nextY;
  }

  node.scrollTop = nextY;
  return nextY;
}
