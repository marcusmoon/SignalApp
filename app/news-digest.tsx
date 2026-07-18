import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { DigestDetailContent } from '@/components/signal/DigestDetailContent';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

/** 알림·푸시 → 뉴스 다이제스트 상세 (홈 카드는 바텀시트 유지) */
export default function NewsDigestScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const params = useLocalSearchParams<{ id?: string | string[]; digestId?: string | string[] }>();
  const id = useMemo(
    () => firstRouteParam(params.id) || firstRouteParam(params.digestId) || '',
    [params.digestId, params.id],
  );

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="news-digest"
        params={{
          ...(id ? { id } : null),
        }}
      />
    );
  }

  return <DigestDetailContent kind="news" id={id || null} />;
}
