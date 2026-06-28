import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { useIsFocused } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { HomeBriefingContent } from '@/components/signal/HomeBriefingContent';
import { HomeFocusContent } from '@/components/signal/HomeFocusContent';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { tabBarBottomInset } from '@/constants/tabBar';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { loadHomeVariant, subscribeHomeVariantChanged, type HomeVariant } from '@/services/homeVariantPreference';

export default function HomeTabScreen() {
  const { theme } = useSignalTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const todayYmd = useRollingLocalYmd();
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [homeVariant, setHomeVariant] = useState<HomeVariant>('classic');

  useEffect(() => {
    const prevToday = todayYmdRef.current;
    todayYmdRef.current = todayYmd;
    setSelectedYmd((prev) => (prev === prevToday || prev > todayYmd ? todayYmd : prev));
  }, [todayYmd]);

  useEffect(() => {
    void loadHomeVariant().then(setHomeVariant);
    return subscribeHomeVariantChanged(() => {
      void loadHomeVariant().then(setHomeVariant);
    });
  }, []);

  const HomeContent = homeVariant === 'focus' ? HomeFocusContent : HomeBriefingContent;

  return (
    <SafeAreaView style={{ flex: 1, minHeight: 0, backgroundColor: theme.bg }} edges={['top']}>
      <SignalHeader compact />
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={{ flex: 1, minHeight: 0 }}>
        <HomeContent
          selectedYmd={selectedYmd}
          todayYmd={todayYmd}
          onSelectedYmdChange={setSelectedYmd}
          scrollContentPaddingBottom={24 + tabBarHeight + tabBarBottomInset(insets.bottom)}
        />
      </View>
    </SafeAreaView>
  );
}
