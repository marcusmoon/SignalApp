import { useCallback } from 'react';
import { InteractionManager } from 'react-native';

export function useRefreshWithScrollToTop(
  onRefresh: () => void | Promise<void>,
  scrollToTop: (animated?: boolean) => void,
) {
  return useCallback(() => {
    scrollToTop(false);
    void Promise.resolve(onRefresh()).finally(() => {
      scrollToTop(false);
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => scrollToTop(false));
      }
      InteractionManager.runAfterInteractions(() => {
        scrollToTop(false);
        setTimeout(() => scrollToTop(false), 300);
      });
    });
  }, [onRefresh, scrollToTop]);
}
