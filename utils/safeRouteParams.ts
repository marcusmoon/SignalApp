import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager } from 'react-native';

type RouteParams = Record<string, string | undefined>;

/** Root Layout·Slot 마운트가 끝난 뒤에만 라우터 조작을 허용한다. */
export function useNavigationDispatchReady(): boolean {
  const rootNavigationState = useRootNavigationState();
  const navKeyed = Boolean(rootNavigationState?.key);
  const [dispatchReady, setDispatchReady] = useState(false);

  useEffect(() => {
    if (!navKeyed) {
      setDispatchReady(false);
      return;
    }
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        if (!cancelled) setDispatchReady(true);
      });
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [navKeyed]);

  return dispatchReady;
}

/** Root Layout 마운트 전 `router.setParams` 호출을 큐에 넣었다가 준비 후 반영한다. */
export function useSafeSetRouteParams() {
  const router = useRouter();
  const dispatchReady = useNavigationDispatchReady();
  const pendingRef = useRef<RouteParams>({});
  const flushScheduledRef = useRef(false);

  const flushPending = useCallback(() => {
    flushScheduledRef.current = false;
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;
    router.setParams(pending);
    pendingRef.current = {};
  }, [router]);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    requestAnimationFrame(flushPending);
  }, [flushPending]);

  const setRouteParams = useCallback(
    (params: RouteParams) => {
      pendingRef.current = { ...pendingRef.current, ...params };
      if (!dispatchReady) return;
      scheduleFlush();
    },
    [dispatchReady, scheduleFlush],
  );

  useEffect(() => {
    if (!dispatchReady) return;
    scheduleFlush();
  }, [dispatchReady, scheduleFlush]);

  return setRouteParams;
}
