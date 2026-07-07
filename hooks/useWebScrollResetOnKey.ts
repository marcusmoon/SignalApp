import { useCallback, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

const WEB_SCROLL_RESET_RETRY_MS = [0, 0, 16, 50, 150, 300, 500, 800];

function resetNodeScrollTop(node: HTMLElement | null) {
  if (node) node.scrollTop = 0;
}

function resetNodeScrollTopWithRetry(getNode: () => HTMLElement | null) {
  for (const delay of WEB_SCROLL_RESET_RETRY_MS) {
    if (delay === 0) {
      resetNodeScrollTop(getNode());
    } else {
      setTimeout(() => resetNodeScrollTop(getNode()), delay);
    }
  }

  let attempts = 0;
  const tick = () => {
    const node = getNode();
    resetNodeScrollTop(node);
    if (!node || node.scrollTop <= 1) return;
    attempts += 1;
    if (attempts < 90) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Web DOM scroll containers keep `scrollTop` when inner list HTML is swapped.
 * Reset immediately on filter-key change, then once more after data revision updates.
 */
export function useWebScrollResetOnKey(
  getNode: () => HTMLElement | null,
  scrollResetKey?: string | number | null,
  dataRevision?: unknown,
) {
  const pendingAfterDataRef = useRef(false);
  const getNodeRef = useRef(getNode);
  getNodeRef.current = getNode;

  const resolveNode = useCallback(() => getNodeRef.current(), []);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || scrollResetKey == null) return;
    pendingAfterDataRef.current = true;
    resetNodeScrollTopWithRetry(resolveNode);
  }, [resolveNode, scrollResetKey]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !pendingAfterDataRef.current) return;
    resetNodeScrollTopWithRetry(resolveNode);
    pendingAfterDataRef.current = false;
  }, [dataRevision, resolveNode]);
}
