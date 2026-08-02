import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import {
  FLOATING_GLASS_FAB_GAP,
  FLOATING_GLASS_FAB_SIZE,
  FloatingGlassFab,
} from '@/components/signal/FloatingGlassFab';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { fabStackBottom, tabScreenScrollBottomPadding } from '@/constants/screenLayout';
import { webFlexFill, webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';

/** Phone tab chrome is iPhone-only for this FAB (not web phone, not iPad). */
const SHOW_HOME_REFRESH_FAB = Platform.OS === 'ios';

export default function HomeTabScreen() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const { useTwoPane } = useResponsiveLayout();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const pullRefreshRef = useRef<(() => void) | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  const showRefreshFab = SHOW_HOME_REFRESH_FAB && isFocused;
  const scrollBottom = useMemo(() => {
    const base = tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);
    if (!SHOW_HOME_REFRESH_FAB) return base;
    return base + FLOATING_GLASS_FAB_SIZE + FLOATING_GLASS_FAB_GAP;
  }, [insets.bottom, tabBarHeight]);
  const fabBottom = fabStackBottom(tabBarHeight, insets.bottom);

  // Wide: home lives in the overlay pane (`IpadHomeScreen`). Skip the hidden tab tree.
  if (useTwoPane) return null;

  return (
    <SafeAreaView style={{ ...webFlexFill, backgroundColor: webShellBackground(theme.bg) }} edges={['top']}>
      <SignalHeader compact onBrandPress={() => pullRefreshRef.current?.()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={{ ...webFlexFill, backgroundColor: webShellBackground(theme.bg) }}>
        <HomeFocusContent
          selectedYmd={selectedYmd}
          todayYmd={todayYmd}
          onSelectedYmdChange={setSelectedYmd}
          scrollContentPaddingBottom={scrollBottom}
          onPullRefreshReady={(refresh) => {
            pullRefreshRef.current = refresh;
          }}
          onRefreshingChange={setRefreshing}
        />
      </View>
      {showRefreshFab ? (
        <FloatingGlassFab
          bottom={fabBottom}
          iconName="sync-alt"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing}
          active={refreshing}
          onPress={() => pullRefreshRef.current?.()}
        />
      ) : null}
    </SafeAreaView>
  );
}
