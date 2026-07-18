import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';

import { EtfInsightDetailContent } from '@/components/signal/EtfInsightDetailContent';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

/** 홈 카드 / 리스트 행 → ETF 인사이트 상세 */
export default function EtfInsightScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const params = useLocalSearchParams<{ id?: string | string[]; date?: string | string[] }>();
  const id = useMemo(() => firstRouteParam(params.id) || '', [params.id]);
  const date = useMemo(() => firstRouteParam(params.date) || '', [params.date]);

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="etf-insight"
        params={{
          ...(id ? { id } : null),
          ...(date ? { date } : null),
        }}
      />
    );
  }

  return <EtfInsightDetailContent id={id || null} date={date || null} />;
}
