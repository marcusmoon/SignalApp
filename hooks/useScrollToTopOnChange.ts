import { useCallback, useEffect, useRef, type DependencyList, type RefObject } from 'react';
import { Platform } from 'react-native';

import {
  enforceScrollToTopOnWeb,
  scrollToTopWithRetry,
  type ScrollToTopTarget,
} from '@/utils/scrollToTop';

type Options = {
  /** Skip scroll on first effect run (default true). */
  skipInitial?: boolean;
  animated?: boolean;
  /** After filter deps change, re-scroll when list data arrives (web load swap). */
  resyncDeps?: DependencyList;
};

export function useScrollToTopOnChange<T extends ScrollToTopTarget = ScrollToTopTarget>(
  deps: DependencyList,
  options: Options = {},
) {
  const ref = useRef<T | null>(null);
  const skipInitialRef = useRef(options.skipInitial !== false);
  const pendingScrollRef = useRef(false);
  const animated = options.animated ?? false;

  const scrollToTop = useCallback(
    (useAnimated = animated) => {
      scrollToTopWithRetry(ref as RefObject<ScrollToTopTarget>, useAnimated);
    },
    [animated],
  );

  const beginFilterScroll = useCallback(() => {
    pendingScrollRef.current = true;
    scrollToTop(false);
    if (Platform.OS === 'web') {
      enforceScrollToTopOnWeb(
        ref as RefObject<ScrollToTopTarget>,
        () => pendingScrollRef.current,
        false,
      );
    }
  }, [scrollToTop]);

  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }
    beginFilterScroll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit dependency list from caller
  }, deps);

  useEffect(() => {
    if (!pendingScrollRef.current) return;
    scrollToTop(false);
    const node = ref.current?.getScrollableNode?.();
    if (
      Platform.OS === 'web' &&
      node &&
      typeof node === 'object' &&
      'scrollTop' in node &&
      (node as HTMLElement).scrollTop <= 1
    ) {
      pendingScrollRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync when caller list data updates
  }, options.resyncDeps ?? []);

  return { ref, scrollToTop };
}
