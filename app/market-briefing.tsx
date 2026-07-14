import { Stack, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import SignalScreen from './(tabs)/signal';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';

/** 홈 → 시장 브리핑 — Account/More 자식과 동일한 root Stack 헤더 */
export default function MarketBriefingScreen() {
  const { t } = useLocale();
  const router = useRouter();

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
