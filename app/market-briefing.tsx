import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import SignalScreen from './(tabs)/signal';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

/** 홈 → 시장 브리핑 — phone은 root Stack, wide는 홈 overlay + WideSubpaneHeader */
export default function MarketBriefingScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const { useTwoPane } = useResponsiveLayout();
  const routeParams = useLocalSearchParams<{ session?: string | string[]; date?: string | string[] }>();
  const session = firstRouteParam(routeParams.session) || undefined;
  const date = firstRouteParam(routeParams.date) || undefined;

  if (useTwoPane) {
    return (
      <WideOverlayRouteRedirect
        kind="market-briefing"
        params={{
          ...(session ? { session } : null),
          ...(date ? { date } : null),
        }}
      />
    );
  }

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={{
            title: t('ipadHomeSignalTitle'),
            headerBackVisible: false,
            headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <SignalScreen />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
