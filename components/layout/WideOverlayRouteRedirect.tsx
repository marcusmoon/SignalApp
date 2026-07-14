import { useRouter } from 'expo-router';
import { useLayoutEffect, useRef } from 'react';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { WIDE_HOME_ROUTE, type WideOverlayKind } from '@/utils/wideOverlayRoute';

type Props = {
  kind: WideOverlayKind;
  params?: Record<string, string | undefined>;
};

/** Wide web: 레거시 스택 URL → 홈 오버레이로 치환해 우측 패널만 갱신한다. */
export function WideOverlayRouteRedirect({ kind, params = {} }: Props) {
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();
  const redirectedRef = useRef(false);

  useLayoutEffect(() => {
    if (!useTwoPane || redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace({
      pathname: WIDE_HOME_ROUTE,
      params: { overlay: kind, ...params },
    } as never);
  }, [kind, params, router, useTwoPane]);

  return null;
}
