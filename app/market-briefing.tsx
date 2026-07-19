import { useLocalSearchParams } from 'expo-router';

import { MarketBriefingDetailContent } from '@/components/signal/MarketBriefingDetailContent';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

/** 홈·알림 → 장중 브리핑 단건 상세 (시장 탭 허브와 분리) */
export default function MarketBriefingScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const routeParams = useLocalSearchParams<{
    session?: string | string[];
    date?: string | string[];
    from?: string | string[];
  }>();
  const session = firstRouteParam(routeParams.session) || undefined;
  const date = firstRouteParam(routeParams.date) || undefined;
  const from = firstRouteParam(routeParams.from) || '';

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="market-briefing"
        params={{
          ...(session ? { session } : null),
          ...(date ? { date } : null),
          ...(from === 'home' || from === 'alerts' ? { from } : null),
        }}
      />
    );
  }

  return <MarketBriefingDetailContent session={session} date={date} />;
}
