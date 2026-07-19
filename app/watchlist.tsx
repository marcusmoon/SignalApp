import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { QuotesContent } from '@/components/quotes/QuotesContent';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { useLocale } from '@/contexts/LocaleContext';
import { QUOTES_SEGMENT_KEYS, type QuoteSegmentKey } from '@/domain/quotes/constants';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import type { MessageId } from '@/locales/messages';
import { firstRouteParam } from '@/utils/routeSearchParams';

const QUOTE_SEGMENT_LABEL: Record<QuoteSegmentKey, MessageId> = {
  watch: 'quotesSegmentWatch',
  popular: 'quotesSegmentPopular',
  mcap: 'quotesSegmentMcap',
  coin: 'quotesSegmentCoin',
};

function parseSegment(raw: string | undefined): QuoteSegmentKey {
  const value = String(raw || '').trim();
  return (QUOTES_SEGMENT_KEYS as readonly string[]).includes(value)
    ? (value as QuoteSegmentKey)
    : 'watch';
}

function titleKey(segment: QuoteSegmentKey): MessageId {
  return segment === 'watch' ? 'homeFocusWatchTitle' : QUOTE_SEGMENT_LABEL[segment];
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

  return (
    <>
      <Stack.Screen
        options={{
          title: t(titleKey(segment)),
          headerBackVisible: false,
          headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <BottomTabBarHeightContext.Provider value={0}>
        <QuotesContent embedded lockedSegment={segment} />
      </BottomTabBarHeightContext.Provider>
    </>
  );
}
