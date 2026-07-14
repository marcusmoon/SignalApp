import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/**
 * Interval that only runs while `enabled` is true and (on web) the document is visible.
 * Use with `isFocused` to stop hidden wide-web tabs from polling.
 */
export function useVisibleInterval(
  callback: () => void,
  ms: number,
  enabled: boolean,
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled || ms <= 0) return;

    let id: ReturnType<typeof setInterval> | undefined;

    const isDocVisible = () => {
      if (Platform.OS !== 'web' || typeof document === 'undefined') return true;
      return document.visibilityState === 'visible';
    };

    const start = () => {
      if (id) return;
      if (!isDocVisible()) return;
      id = setInterval(() => {
        if (!isDocVisible()) return;
        callbackRef.current();
      }, ms);
    };

    const stop = () => {
      if (!id) return;
      clearInterval(id);
      id = undefined;
    };

    start();

    const onVisibility = () => {
      if (isDocVisible()) start();
      else stop();
    };

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      stop();
      appSub.remove();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [enabled, ms]);
}
