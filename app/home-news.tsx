import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { PhoneHeaderBackButton } from '@/components/layout/PhoneHeaderBackButton';
import { LegacyNewsFeedScreen } from '@/components/news/LegacyNewsFeedScreen';
import { DEFAULT_NEWS_SEGMENT, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

function parseSegment(raw: string | undefined): NewsSegmentKey {
  return parseNewsSegmentKey(raw) ?? DEFAULT_NEWS_SEGMENT;
}

/** 홈 숏컷 → 뉴스 세그먼트 드릴 + 백 */
export default function HomeNewsScreen() {
  const { useTwoPane } = useResponsiveLayout();
  const { t } = useLocale();
  const router = useRouter();
  const params = useLocalSearchParams<{ segment?: string | string[] }>();
  const segment = useMemo(
    () => parseSegment(firstRouteParam(params.segment)),
    [params.segment],
  );

  if (useTwoPane) {
    return <WideOverlayRouteRedirect kind="news-feed" params={{ segment }} />;
  }

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={{
            title: t(NEWS_SEGMENT_LABEL[segment]),
            headerBackVisible: false,
            headerLeft: () => <PhoneHeaderBackButton onPress={() => router.back()} />,
          }}
        />
        <LegacyNewsFeedScreen stackChrome lockedSegment={segment} />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
