import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { BoardContent } from '@/components/community/BoardContent';
import { communitySourceLabelId } from '@/components/community/CommunityPostCard';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
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
  const params = useLocalSearchParams<{ source?: string | string[]; lock?: string | string[] }>();
  const initialSource = useMemo(
    () => parseSource(firstRouteParam(params.source)),
    [params.source],
  );
  const locked = firstRouteParam(params.lock) === '1';
  const lockedSource = locked ? initialSource : null;
  const title =
    lockedSource && lockedSource !== COMMUNITY_SOURCE_ALL
      ? t(communitySourceLabelId(lockedSource))
      : t('screenBoard');

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={signalDrillStackOptions({
            title,
            onBack: () => router.back(),
          })}
        />
        <BoardContent
          tabBarHeight={0}
          active
          stackChrome
          initialSource={initialSource}
          lockedSource={lockedSource}
        />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
