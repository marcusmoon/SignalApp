/**
 * Resolve a DOM element from an RN Web ref.
 *
 * ScrollView/FlatList expose `getScrollableNode()`. Plain `View` refs on RN Web
 * ARE the HTMLElement and do not implement `getScrollableNode` — callers that
 * only use getScrollableNode never attach ResizeObserver / viewport metrics.
 */

export function isWebDomElement(node: unknown): node is HTMLElement {
  if (typeof HTMLElement !== 'undefined' && node instanceof HTMLElement) return true;
  // Node / non-browser fallbacks (tests): duck-type Element.
  return (
    typeof node === 'object' &&
    node !== null &&
    (node as { nodeType?: unknown }).nodeType === 1 &&
    typeof (node as { ownerDocument?: unknown }).ownerDocument === 'object'
  );
}

export function resolveWebDomNode(ref: unknown): HTMLElement | null {
  if (ref == null || typeof ref !== 'object') return null;

  const viaGetter = (ref as { getScrollableNode?: () => unknown }).getScrollableNode?.();
  if (isWebDomElement(viaGetter)) return viaGetter;

  if (isWebDomElement(ref)) return ref;

  return null;
}
