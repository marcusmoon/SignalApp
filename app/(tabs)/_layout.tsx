import { useNavigationState } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { BottomTabBarButtonProps, BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_FLOAT_HEIGHT,
  tabBarHorizontalMargin,
  tabBarPositionBottom,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import {
  GlassSurfaceBackground,
  colorWithAlpha,
  glassEdgeColors,
} from '@/components/signal/GlassSurface';
import { SignalFloatingTabBar } from '@/components/signal/SignalFloatingTabBar';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { hasSignalApi } from '@/services/env';
import {
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadCheckIntervalMs,
  subscribeNewsUnreadCheckIntervalChanged,
} from '@/services/newsUnreadCheckIntervalPreference';
import {
  loadNewsUnreadCached,
  refreshNewsUnreadFromServer,
  subscribeNewsSeenChanged,
} from '@/services/newsUnreadPreference';
import {
  loadTabBarOpacityLevel,
  subscribeTabBarOpacityChanged,
  tabBarOpacityForLevel,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';

const TAB_ICON_SIZE = 25;

type TabBarIconName = 'newspaper' | 'chart-line' | 'home' | 'youtube' | 'th-large';

function TabBarIcon({
  name,
  color,
  focused = false,
  showDot,
}: {
  name: TabBarIconName;
  color: string;
  focused?: boolean;
  showDot?: boolean;
}) {
  return (
    <View style={tabIconWrap}>
      <FontAwesome5 name={name} size={TAB_ICON_SIZE} color={color} solid />
      {showDot ? <View style={tabIconDot} /> : null}
    </View>
  );
}

const tabIconWrap = {
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  height: TAB_ICON_SIZE + 2,
};

const tabIconDot = {
  position: 'absolute' as const,
  top: 0,
  right: -2,
  width: 7,
  height: 7,
  borderRadius: 3.5,
  backgroundColor: '#F04452',
};

export default function TabLayout() {
  const { theme, effectiveColorScheme } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const [newsHasUnread, setNewsHasUnread] = useState(false);
  const [tabBarOpacityLevel, setTabBarOpacityLevel] = useState<TabBarOpacityLevel>(3);
  const newsTabFocused = useNavigationState((state) => {
    const route = state.routes[state.index];
    return route?.name === 'news';
  });

  const refreshNewsUnreadBadge = useCallback(async () => {
    if (!hasSignalApi()) {
      setNewsHasUnread(false);
      return;
    }
    if (newsTabFocused) {
      setNewsHasUnread(false);
      return;
    }
    try {
      setNewsHasUnread(await refreshNewsUnreadFromServer(locale));
    } catch {
      const cached = await loadNewsUnreadCached();
      if (cached !== null) setNewsHasUnread(cached);
    }
  }, [locale, newsTabFocused]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const startPolling = async () => {
      const minutes = await loadNewsUnreadCheckIntervalMinutes();
      if (cancelled) return;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => void refreshNewsUnreadBadge(), newsUnreadCheckIntervalMs(minutes));
    };

    void loadNewsUnreadCached().then((cached) => {
      if (cached === true && !newsTabFocused) setNewsHasUnread(true);
    });
    void refreshNewsUnreadBadge();
    void startPolling();

    const unsubscribeSeen = subscribeNewsSeenChanged(() => void refreshNewsUnreadBadge());
    const unsubscribeInterval = subscribeNewsUnreadCheckIntervalChanged(() => {
      void startPolling();
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refreshNewsUnreadBadge();
    });
    return () => {
      cancelled = true;
      unsubscribeSeen();
      unsubscribeInterval();
      if (pollTimer) clearInterval(pollTimer);
      appStateSub.remove();
    };
  }, [newsTabFocused, refreshNewsUnreadBadge]);

  useEffect(() => {
    void loadTabBarOpacityLevel().then(setTabBarOpacityLevel);
    return subscribeTabBarOpacityChanged(() => {
      void loadTabBarOpacityLevel().then(setTabBarOpacityLevel);
    });
  }, []);

  /**
   * 웹: @react-navigation/bottom-tabs 의 BottomTabItem(uikit)이 `padding: 5` + 아이콘(~24) + 라벨(lineHeight) +
   * 우리의 tabBarItemStyle 패딩을 합하면 **한 줄 높이(tabBarContentHeight)를 넘기 쉬워** 글자 하단이 잘린다.
   * `overflow: 'visible'` + 충분한 content 높이로 맞춘다.
   */
  const isWeb = Platform.OS === 'web';
  const tabBarInnerPadBottom = isWeb ? 9 : 7;
  const tabBarInnerPadTop = isWeb ? 6 : 6;
  const tabBarContentHeight = isWeb ? TAB_BAR_FLOAT_HEIGHT + 14 : TAB_BAR_FLOAT_HEIGHT;
  /** 콘텐츠 높이만 — safe area·좌우 inset 은 SignalFloatingTabBar 가 처리 */
  const tabBarTotalHeight = tabBarContentHeight + tabBarInnerPadTop + tabBarInnerPadBottom;
  const tabBarMarginH = tabBarHorizontalMargin();
  const tabBarBottom = tabBarPositionBottom(insets.bottom);
  const tabBarBg = colorWithAlpha(theme.card, tabBarOpacityForLevel(tabBarOpacityLevel));
  const tabBarEdge = glassEdgeColors(effectiveColorScheme, theme.border);

  const screenOptions = useMemo(
    (): BottomTabNavigationOptions => ({
        /**
         * 'shift'/'fade'는 씬에 opacity 보간을 걸어, 전환 타이밍이 꼬이면 포커스된 탭이 투명(빈 화면)으로 남는 문제가 있다.
         * 전환 애니메이션 없이 즉시 표시.
         */
        animation: 'none',
        tabBarActiveTintColor: theme.green,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          height: tabBarTotalHeight,
          paddingBottom: tabBarInnerPadBottom,
          paddingTop: tabBarInnerPadTop,
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderRadius: TAB_BAR_FLOAT_RADIUS,
          overflow: isWeb ? 'visible' : 'hidden',
          paddingHorizontal: 10,
          ...(isWeb
            ? {
                position: 'absolute' as const,
                left: tabBarMarginH,
                right: tabBarMarginH,
                bottom: tabBarBottom,
              }
            : {
                marginBottom: 0,
                start: 0,
                end: 0,
                bottom: 0,
              }),
          ...(Platform.OS === 'ios'
            ? {
                shadowColor: '#000000',
                shadowOpacity: effectiveColorScheme === 'dark' ? 0.35 : 0.12,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 10 },
              }
            : {
                shadowColor: '#191F28',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.14,
                shadowRadius: 16,
                elevation: 10,
              }),
        },
        tabBarBackground: () => (
          <GlassSurfaceBackground
            backgroundColor={tabBarBg}
            borderRadius={TAB_BAR_FLOAT_RADIUS}
            edge={tabBarEdge}
            showTopHighlight
          />
        ),
        tabBarLabelPosition: 'below-icon',
        tabBarAllowFontScaling: false,
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 13,
          fontWeight: Platform.OS === 'ios' ? '800' : '700',
          letterSpacing: Platform.OS === 'ios' ? -0.15 : 0,
          marginTop: 2,
          marginBottom: 0,
          ...(isWeb
            ? {
                fontSize: 11,
                lineHeight: 17,
                marginTop: 0,
                marginBottom: 0,
                paddingBottom: 2,
              }
            : {}),
        },
        tabBarItemStyle: {
          paddingTop: isWeb ? 2 : 0,
          paddingBottom: isWeb ? 3 : 0,
          paddingHorizontal: 0,
          ...(isWeb ? { overflow: 'visible' as const } : {}),
          justifyContent: 'center',
          alignItems: 'center',
          minWidth: 0,
          flex: 1,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarButton: (props: BottomTabBarButtonProps) => <SlackTabBarButton {...props} />,
        headerShown: false,
        /** 탭 복귀 시 화면이 비는(react-native-screens freeze) 경우 완화 */
        freezeOnBlur: false,
        /** 첫 탭 진입 시 레이아웃만 있고 내용이 안 그려지는 경우 완화 */
        lazy: false,
      }),
    [
      tabBarTotalHeight,
      tabBarBottom,
      tabBarMarginH,
      tabBarInnerPadBottom,
      tabBarInnerPadTop,
      tabBarOpacityLevel,
      tabBarBg,
      tabBarEdge,
      insets.bottom,
      isWeb,
      theme.green,
      theme.textMuted,
      effectiveColorScheme,
    ],
  );

  return (
    <Tabs
      initialRouteName="index"
      tabBar={isWeb ? undefined : (props) => <SignalFloatingTabBar {...props} />}
      screenOptions={screenOptions}
      detachInactiveScreens={false}>
      {/* 순서: TAB_BAR_SCREEN_ORDER — 뉴스 · 시세 · 홈 · 유튜브 · 더보기 */}
      <Tabs.Screen
        name="news"
        options={{
          title: t('tabNews'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="newspaper" color={color} focused={focused} showDot={newsHasUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t('tabQuotes'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="chart-line" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="youtube"
        options={{
          title: t('tabYoutube'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="youtube" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabMore'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="th-large" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
