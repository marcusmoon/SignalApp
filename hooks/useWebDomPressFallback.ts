import { useEffect, type RefObject } from 'react';
import type { View } from 'react-native';

import { isWeb } from '@/constants/webLayout';

type PressEventHandler = (event: { preventDefault?: () => void; stopPropagation?: () => void }) => void;

function getDomNode(ref: RefObject<View | null>, selector: string): HTMLElement | null {
  const scrollNode = (ref.current as unknown as { getScrollableNode?: () => HTMLElement | null } | null)
    ?.getScrollableNode?.();
  if (scrollNode) return scrollNode;
  if (typeof document === 'undefined') return null;
  return document.querySelector(selector);
}

/** RN Web Pressable can miss mobile Safari taps in fixed overlays; bind DOM events as a narrow web fallback. */
export function useWebDomPressFallback(
  ref: RefObject<View | null>,
  selector: string,
  onPress: PressEventHandler,
) {
  useEffect(() => {
    if (!isWeb) return;
    const node = getDomNode(ref, selector);
    if (!node) return;

    const handleDomPress = (event: Event) => {
      onPress({
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation(),
      });
    };

    node.addEventListener('click', handleDomPress);
    node.addEventListener('pointerup', handleDomPress);
    node.addEventListener('touchend', handleDomPress);
    return () => {
      node.removeEventListener('click', handleDomPress);
      node.removeEventListener('pointerup', handleDomPress);
      node.removeEventListener('touchend', handleDomPress);
    };
  }, [onPress, ref, selector]);
}
