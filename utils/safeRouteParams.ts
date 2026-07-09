import { useRootNavigationState, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';

type RouteParams = Record<string, string | undefined>;

/** Root Layout 마운트 전 `router.setParams` 호출을 큐에 넣었다가 준비 후 반영한다. */
export function useSafeSetRouteParams() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const navReady = Boolean(rootNavigationState?.key);
  const pendingRef = useRef<RouteParams>({});

  const setRouteParams = useCallback(
    (params: RouteParams) => {
      if (!navReady) {
        pendingRef.current = { ...pendingRef.current, ...params };
        return;
      }
      router.setParams(params);
    },
    [navReady, router],
  );

  useEffect(() => {
    if (!navReady) return;
    const pending = pendingRef.current;
    if (Object.keys(pending).length === 0) return;
    router.setParams(pending);
    pendingRef.current = {};
  }, [navReady, router]);

  return setRouteParams;
}
