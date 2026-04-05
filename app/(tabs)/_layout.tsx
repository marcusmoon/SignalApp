import React, { useEffect, useMemo, useState } from 'react';
import { Easing, Platform, StyleSheet, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import type { BottomTabBarButtonProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_FLOAT_HEIGHT,
  TAB_BAR_FLOAT_MARGIN_BOTTOM,
  TAB_BAR_FLOAT_MARGIN_H,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import {
  DEFAULT_TAB_BAR_GLASS_LEVEL,
  TAB_BAR_GLASS_PARAMS,
  type TabBarGlassLevel,
} from '@/constants/tabBarGlass';
import { TabBarGlassSurface } from '@/components/TabBarGlassSurface';
import {
  loadTabBarGlassLevel,
  subscribeTabBarGlassLevelChanged,
} from '@/services/tabBarGlassPreference';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';

const TAB_ICON_SIZE = 22;

function TabBarIcon({
  name,
  color,
}: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused?: boolean;
}) {
  return (
    <View style={tabIconWrap}>
      <FontAwesome name={name} size={TAB_ICON_SIZE} color={color} />
    </View>
  );
}

const tabIconWrap = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  height: TAB_ICON_SIZE + 2,
};

export default function TabLayout() {
  const { theme } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const [tabBarGlassLevel, setTabBarGlassLevel] = useState<TabBarGlassLevel>(DEFAULT_TAB_BAR_GLASS_LEVEL);

  useEffect(() => {
    void loadTabBarGlassLevel().then(setTabBarGlassLevel);
  }, []);

  useEffect(() => {
    return subscribeTabBarGlassLevelChanged(() => {
      void loadTabBarGlassLevel().then(setTabBarGlassLevel);
    });
  }, []);

  const tabBarInnerPadBottom = 6;
  const tabBarInnerPadTop = 6;
  const tabBarContentHeight = TAB_BAR_FLOAT_HEIGHT;
  /** 플로팅 바: 홈 인디케이터 위에 뜨므로 높이에 insets.bottom 미포함 */
  const tabBarTotalHeight = tabBarContentHeight + tabBarInnerPadTop + tabBarInnerPadBottom;
  const tabBarBottom = insets.bottom + TAB_BAR_FLOAT_MARGIN_BOTTOM;

  const glassParams = TAB_BAR_GLASS_PARAMS[tabBarGlassLevel];

  const screenOptions = useMemo(
    (): BottomTabNavigationOptions => ({
        /** 탭 전환: 기본 150ms는 체감이 거의 없음 → 조금 길게 */
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: 280,
            easing: Easing.inOut(Easing.cubic),
          },
        },
        tabBarActiveTintColor: theme.green,
        tabBarInactiveTintColor: 'rgba(142,142,147,0.88)',
        tabBarStyle: {
          position: 'absolute',
          left: TAB_BAR_FLOAT_MARGIN_H,
          right: TAB_BAR_FLOAT_MARGIN_H,
          bottom: tabBarBottom,
          height: tabBarTotalHeight,
          paddingBottom: tabBarInnerPadBottom,
          paddingTop: tabBarInnerPadTop,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderTopColor: 'transparent',
          borderRadius: TAB_BAR_FLOAT_RADIUS,
          overflow: 'hidden',
          paddingHorizontal: 2,
          /** iOS: shadow는 블러와 합성 시 ‘불투명 카드’처럼 보이는 경우가 많음 */
          ...(Platform.OS === 'ios'
            ? { shadowOpacity: 0, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } }
            : {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: glassParams.android.shadowOpacity,
                shadowRadius: glassParams.android.shadowRadius,
                elevation: glassParams.android.elevation,
              }),
        },
        tabBarBackground: () => <TabBarGlassSurface level={tabBarGlassLevel} style={StyleSheet.absoluteFill} />,
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 10,
          lineHeight: 12,
          fontWeight: '600',
          letterSpacing: -0.08,
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 0,
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 1,
        },
        tabBarButton: (props: BottomTabBarButtonProps) => <SlackTabBarButton {...props} />,
        headerShown: false,
      }),
    [
      glassParams.android.elevation,
      glassParams.android.shadowOpacity,
      glassParams.android.shadowRadius,
      tabBarGlassLevel,
      tabBarBottom,
      tabBarTotalHeight,
      tabBarInnerPadBottom,
      tabBarInnerPadTop,
      theme.green,
      t,
    ],
  );

  return (
    <Tabs
      screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabNews'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="newspaper-o" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="youtube"
        options={{
          title: t('tabYoutube'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="youtube-play" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t('tabQuotes'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="line-chart" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: t('tabCalls'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="microphone" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
