import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const DEFAULT_PAD_PX = 240;
const COOLDOWN_MS = 400;

/** Build a RN scroll event from a DOM scroll container (RN Web wheel forwarding). */
export function syntheticScrollEventFromDom(node: HTMLElement): NativeSyntheticEvent<NativeScrollEvent> {
  return {
    nativeEvent: {
      contentOffset: { x: node.scrollLeft, y: node.scrollTop },
      contentSize: { width: node.scrollWidth, height: node.scrollHeight },
      layoutMeasurement: { width: node.clientWidth, height: node.clientHeight },
    },
  } as NativeSyntheticEvent<NativeScrollEvent>;
}

export function isDomNearScrollEnd(node: HTMLElement, padPx = DEFAULT_PAD_PX): boolean {
  const viewH = node.clientHeight;
  const ch = node.scrollHeight;
  if (ch <= viewH + 8) return false;
  const distFromBottom = ch - (node.scrollTop + viewH);
  return distFromBottom <= padPx;
}

export function dispatchDomScrollEvent(node: HTMLElement) {
  node.dispatchEvent(new Event('scroll', { bubbles: true }));
}

export type ScrollLoadMoreGate = {
  onScrollNearEnd: (
    e: NativeSyntheticEvent<NativeScrollEvent>,
    opts: { enabled: boolean; trigger: () => void },
  ) => void;
};

/** FlatList 하단 근접 시 `onEndReached`만으로는 안 잡히는 경우를 보완 */
export function createScrollLoadMoreGate(padPx = DEFAULT_PAD_PX, cooldownMs = COOLDOWN_MS): ScrollLoadMoreGate {
  let last = 0;
  return {
    onScrollNearEnd(e, opts) {
      if (!opts.enabled) return;
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const viewH = layoutMeasurement.height;
      const ch = contentSize.height;
      if (ch <= viewH + 8) return;
      const distFromBottom = ch - (contentOffset.y + viewH);
      if (distFromBottom > padPx) return;
      const now = Date.now();
      if (now - last < cooldownMs) return;
      last = now;
      opts.trigger();
    },
  };
}
