import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { tabScreenScrollBottomPadding } from '@/constants/screenLayout';
import { webFlexFill, webShellBackground } from '@/constants/webLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';

export default function HomeTabScreen() {
  const { theme } = useSignalTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const pullRefreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  return (
      <SafeAreaView style={{ ...webFlexFill, backgroundColor: webShellBackground(theme.bg) }} edges={['top']}>
      <SignalHeader compact onBrandPress={() => pullRefreshRef.current?.()} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={{ ...webFlexFill, backgroundColor: webShellBackground(theme.bg) }}>
        <HomeFocusContent
          selectedYmd={selectedYmd}
          todayYmd={todayYmd}
          onSelectedYmdChange={setSelectedYmd}
          scrollContentPaddingBottom={tabScreenScrollBottomPadding(tabBarHeight, insets.bottom)}
          onPullRefreshReady={(refresh) => {
            pullRefreshRef.current = refresh;
          }}
        />
      </View>
    </SafeAreaView>
  );
}
