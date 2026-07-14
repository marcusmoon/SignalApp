import { Stack, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import YoutubeScreen from './(tabs)/youtube';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';

/** More → 유튜브 — Account와 동일한 root Stack 헤더 */
export default function MoreYoutubeScreen() {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={{
            title: t('tabYoutube'),
            headerBackVisible: false,
            headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <YoutubeScreen />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
