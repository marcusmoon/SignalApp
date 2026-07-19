import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { BoardContent } from '@/components/community/BoardContent';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import {
  COMMUNITY_SOURCE_ALL,
  type CommunitySourceFilter,
} from '@/constants/communitySources';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { firstRouteParam } from '@/utils/routeSearchParams';

function parseSource(raw: string | undefined): CommunitySourceFilter {
  const value = String(raw || '').trim();
  if (value === 'save_user_news' || value === 'naver_likeusstock_free') return value;
  return COMMUNITY_SOURCE_ALL;
}

/** More / 홈 숏컷 → 보드 — root Stack 헤더 + 백 */
export default function MoreBoardScreen() {
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string | string[] }>();
  const initialSource = useMemo(
    () => parseSource(firstRouteParam(params.source)),
    [params.source],
  );

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
        <BoardContent
          tabBarHeight={0}
          active
          stackChrome
          initialSource={initialSource}
        />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
