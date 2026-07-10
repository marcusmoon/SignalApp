import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { DigestNewsFeedScreen } from '@/components/news/DigestNewsFeedScreen';
import { LegacyNewsFeedScreen } from '@/components/news/LegacyNewsFeedScreen';
import { parseNewsSegmentKey, type NewsSegmentKey } from '@/constants/newsSegment';
import { webShellBackground } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  loadNewsFeedLayout,
  subscribeNewsFeedLayoutChanged,
  type NewsFeedLayout,
} from '@/services/newsFeedLayoutPreference';
import { firstRouteParam } from '@/utils/routeSearchParams';

const LEGACY_ONLY_SEGMENTS = new Set<NewsSegmentKey>(['watch', 'video']);

export default function NewsTabScreen() {
  const { theme } = useSignalTheme();
  const routeParams = useLocalSearchParams<{ segment?: string }>();
  const [layout, setLayout] = useState<NewsFeedLayout>('legacy');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void loadNewsFeedLayout().then((value) => {
      setLayout(value);
      setReady(true);
    });
    return subscribeNewsFeedLayoutChanged(() => {
      void loadNewsFeedLayout().then(setLayout);
    });
  }, []);

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: webShellBackground(theme.bg) }} />;
  }

  const routeSegment = parseNewsSegmentKey(firstRouteParam(routeParams.segment));
  const useLegacy =
    layout === 'legacy' ||
    (routeSegment != null && LEGACY_ONLY_SEGMENTS.has(routeSegment));

  if (useLegacy) {
    return <LegacyNewsFeedScreen />;
  }

  return <DigestNewsFeedScreen />;
}
