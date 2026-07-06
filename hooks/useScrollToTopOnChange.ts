import { useCallback, useEffect, useRef, type DependencyList, type RefObject } from 'react';

import { scrollToTop, type ScrollToTopTarget } from '@/utils/scrollToTop';

type Options = {
  /** Skip scroll on first effect run (default true). */
  skipInitial?: boolean;
  animated?: boolean;
};

export function useScrollToTopOnChange<T extends ScrollToTopTarget = ScrollToTopTarget>(
  deps: DependencyList,
  options: Options = {},
) {
  const ref = useRef<T | null>(null);
  const skipInitialRef = useRef(options.skipInitial !== false);

  const scrollToTopNow = useCallback(
    (animated = options.animated ?? false) => {
      scrollToTop(ref as RefObject<ScrollToTopTarget>, animated);
    },
    [options.animated],
  );

  useEffect(() => {
    if (skipInitialRef.current) {
      skipInitialRef.current = false;
      return;
    }
    scrollToTopNow(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit dependency list from caller
  }, deps);

  return { ref, scrollToTop: scrollToTopNow };
}
