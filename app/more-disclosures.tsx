import { Stack, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import DisclosuresScreen from './(tabs)/disclosures';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';

/** More → 공시 — Account와 동일한 root Stack 헤더 */
export default function MoreDisclosuresScreen() {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={signalDrillStackOptions({
            title: t('tabDisclosures'),
            onBack: () => router.back(),
          })}
        />
        <DisclosuresScreen />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
