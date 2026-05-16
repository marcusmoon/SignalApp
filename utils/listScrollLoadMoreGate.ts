import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const DEFAULT_PAD_PX = 240;
const COOLDOWN_MS = 400;

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
