import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { QuotesContent } from '@/components/quotes/QuotesContent';
import { useLocale } from '@/contexts/LocaleContext';
import { homeShortcutCompoundLabel } from '@/domain/home/shortcutDisplay';
import { QUOTES_SEGMENT_KEYS, type QuoteSegmentKey } from '@/domain/quotes/constants';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

const HOME_TILE_QUOTES: Record<
  QuoteSegmentKey,
  'homeTileQuotesWatch' | 'homeTileQuotesEtf' | 'homeTileQuotesCoin'
> = {
  watch: 'homeTileQuotesWatch',
  etf: 'homeTileQuotesEtf',
  coin: 'homeTileQuotesCoin',
};

function parseSegment(raw: string | undefined): QuoteSegmentKey {
  const value = String(raw || '').trim();
  if (value === 'popular' || value === 'mcap') return 'etf';
  return (QUOTES_SEGMENT_KEYS as readonly string[]).includes(value)
    ? (value as QuoteSegmentKey)
    : 'watch';
}

/** 홈 숏컷·관심 종목 — 시세 세그먼트 드릴 + 백 */
export default function WatchlistScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const segment = useMemo(() => parseSegment(firstRouteParam(params.segment)), [params.segment]);

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="watchlist"
        params={{ segment }}
      />
    );
  }

  const title = homeShortcutCompoundLabel(t('tabQuotes'), t(HOME_TILE_QUOTES[segment]));

  return (
    <>
      <Stack.Screen
        options={signalDrillStackOptions({
          title,
          onBack: () => router.back(),
        })}
      />
      <BottomTabBarHeightContext.Provider value={0}>
        <QuotesContent embedded lockedSegment={segment} />
      </BottomTabBarHeightContext.Provider>
    </>
  );
}
