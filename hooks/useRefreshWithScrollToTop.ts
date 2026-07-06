import { useCallback } from 'react';

export function useRefreshWithScrollToTop(
  onRefresh: () => void | Promise<void>,
  scrollToTop: (animated?: boolean) => void,
) {
  return useCallback(() => {
    scrollToTop(false);
    void Promise.resolve(onRefresh()).finally(() => {
      scrollToTop(false);
      requestAnimationFrame(() => scrollToTop(false));
    });
  }, [onRefresh, scrollToTop]);
}
