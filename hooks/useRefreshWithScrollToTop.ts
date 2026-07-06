import { useCallback } from 'react';

export function useRefreshWithScrollToTop(
  onRefresh: () => void | Promise<void>,
  scrollToTop: (animated?: boolean) => void,
) {
  return useCallback(() => {
    scrollToTop(false);
    void onRefresh();
  }, [onRefresh, scrollToTop]);
}
