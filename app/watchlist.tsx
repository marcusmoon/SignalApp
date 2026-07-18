import { Stack, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { QuotesContent } from '@/components/quotes/QuotesContent';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { useLocale } from '@/contexts/LocaleContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

/** 홈 관심 종목 `>` — 관심만 표시 + 백 */
export default function WatchlistScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const router = useRouter();

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="watchlist" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('homeFocusWatchTitle'),
          headerBackVisible: false,
          headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
        }}
      />
      <BottomTabBarHeightContext.Provider value={0}>
        <QuotesContent embedded lockedSegment="watch" />
      </BottomTabBarHeightContext.Provider>
    </>
  );
}
