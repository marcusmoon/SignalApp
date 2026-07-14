import { Stack, useRouter } from 'expo-router';
import { useLayoutEffect, useMemo, useRef } from 'react';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WIDE_HOME_ROUTE, type WideOverlayKind } from '@/utils/wideOverlayRoute';

type Props = {
  kind: WideOverlayKind;
  params?: Record<string, string | undefined>;
};

/** Wide web: 레거시 스택 URL → 홈 오버레이로 치환해 우측 패널만 갱신한다. */
export function WideOverlayRouteRedirect({ kind, params }: Props) {
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();
  const redirectedRef = useRef(false);
  const paramsKey = useMemo(
    () =>
      Object.entries(params ?? {})
        .filter(([, value]) => value != null && value !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join('&'),
    [params],
  );

  useLayoutEffect(() => {
    if (!useTwoPane || redirectedRef.current) return;
    redirectedRef.current = true;
    const nextParams: Record<string, string> = { overlay: kind };
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value != null && value !== '') nextParams[key] = value;
      }
    }
    router.replace({
      pathname: WIDE_HOME_ROUTE,
      params: nextParams,
    } as never);
  }, [kind, params, paramsKey, router, useTwoPane]);

  // 리다이렉트 순간 네이티브 스택 헤더가 깜빡이지 않게 숨긴다.
  return <Stack.Screen options={{ headerShown: false, animation: 'none' }} />;
}
