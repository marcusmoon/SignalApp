import { Stack, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';

import { BoardContent } from '@/components/community/BoardContent';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';

/** More → 보드 — Account와 동일한 root Stack 헤더 */
export default function MoreBoardScreen() {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={{
            title: t('screenBoard'),
            headerBackVisible: false,
            headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <BoardContent tabBarHeight={0} active stackChrome />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
