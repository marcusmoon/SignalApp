import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { useMemo } from 'react';

import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { LegacyNewsFeedScreen } from '@/components/news/LegacyNewsFeedScreen';
import { DEFAULT_NEWS_SEGMENT, parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { PhoneMoreStackChromeProvider } from '@/contexts/PhoneMoreStackChromeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { homeShortcutCompoundLabel } from '@/domain/home/shortcutDisplay';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { firstRouteParam } from '@/utils/routeSearchParams';

function parseSegment(raw: string | undefined): NewsSegmentKey {
  return parseNewsSegmentKey(raw) ?? DEFAULT_NEWS_SEGMENT;
}

const HOME_TILE_NEWS: Record<NewsSegmentKey, 'homeTileNewsGlobal' | 'homeTileNewsKorea' | 'homeTileNewsCrypto' | 'homeTileNewsIt' | 'homeTileNewsVideo'> = {
  global: 'homeTileNewsGlobal',
  korea: 'homeTileNewsKorea',
  crypto: 'homeTileNewsCrypto',
  it: 'homeTileNewsIt',
  video: 'homeTileNewsVideo',
};

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

  const title = homeShortcutCompoundLabel(t('tabNews'), t(HOME_TILE_NEWS[segment]));

  return (
    <PhoneMoreStackChromeProvider>
      <BottomTabBarHeightContext.Provider value={0}>
        <Stack.Screen
          options={signalDrillStackOptions({
            title,
            onBack: () => router.back(),
          })}
        />
        <LegacyNewsFeedScreen stackChrome lockedSegment={segment} />
      </BottomTabBarHeightContext.Provider>
    </PhoneMoreStackChromeProvider>
  );
}
