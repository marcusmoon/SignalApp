import { useCallback, useLayoutEffect, useRef } from 'react';
import { Platform } from 'react-native';

function resetNodeScrollTop(node: HTMLElement | null) {
  if (node) node.scrollTop = 0;
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
    resetNodeScrollTop(resolveNode());
  }, [resolveNode, scrollResetKey]);

  useLayoutEffect(() => {
    if (Platform.OS !== 'web' || !pendingAfterDataRef.current) return;
    resetNodeScrollTop(resolveNode());
    pendingAfterDataRef.current = false;
  }, [dataRevision, resolveNode]);
}
