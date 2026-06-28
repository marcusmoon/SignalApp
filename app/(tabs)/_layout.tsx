import { useNavigationState } from "expo-router/react-navigation";
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet, View, type ColorValue } from 'react-native';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import type { BottomTabBarButtonProps, BottomTabNavigationOptions } from "expo-router/js-tabs";
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  TAB_BAR_FLOAT_HEIGHT,
  tabBarHorizontalMargin,
  tabBarPositionBottom,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import { webTabNavigatorHostStyle, webTabSceneStyle, webFlexFill, webSidebarContentStyle, webSidebarPaneFill } from '@/constants/webLayout';
import {
  GlassSurfaceBackground,
  colorWithAlpha,
  glassEdgeColors,
} from '@/components/signal/GlassSurface';
import { SignalFloatingTabBar } from '@/components/signal/SignalFloatingTabBar';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalSidebarTabBar } from '@/components/signal/SignalSidebarTabBar';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import AccountScreen from '@/app/account';
import { NewsIssuesContent } from '@/app/news-issues';
import SettingsScreen from '@/app/settings';
import { IpadHomeScreen } from '@/components/signal/IpadHomeScreen';
import { IpadSidebarNavProvider, useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
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
  loadDisclosureUnreadCached,
  refreshDisclosureUnreadFromServer,
  subscribeDisclosureSeenChanged,
} from '@/services/disclosureUnreadPreference';
import {
  loadSignalUnreadCached,
  refreshSignalUnreadFromServer,
  subscribeSignalSeenChanged,
} from '@/services/signalUnreadPreference';
import {
  loadTabBarOpacityLevel,
  subscribeTabBarOpacityChanged,
  tabBarOpacityForLevel,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';

const TAB_ICON_SIZE = 25;

type TabBarIconName = 'home' | 'newspaper' | 'file-alt' | 'chart-line' | 'highlighter' | 'youtube' | 'th-large';

function TabBarIcon({
  name,
  color,
  focused = false,
  showDot,
}: {
  name: TabBarIconName;
  color: ColorValue;
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
  const { isWideLayout } = useResponsiveLayout();
  const [newsHasUnread, setNewsHasUnread] = useState(false);
  const [signalHasUnread, setSignalHasUnread] = useState(false);
  const [disclosureHasUnread, setDisclosureHasUnread] = useState(false);
  const [tabBarOpacityLevel, setTabBarOpacityLevel] = useState<TabBarOpacityLevel>(3);
  const newsTabFocused = useNavigationState((state) => {
    const route = state.routes[state.index];
    return route?.name === 'news';
  });
  const signalTabFocused = useNavigationState((state) => {
    const route = state.routes[state.index];
    return route?.name === 'signal';
  });
  const disclosureTabFocused = useNavigationState((state) => {
    const route = state.routes[state.index];
    return route?.name === 'disclosures';
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

  const refreshSignalUnreadBadge = useCallback(async () => {
    if (!hasSignalApi()) {
      setSignalHasUnread(false);
      return;
    }
    if (signalTabFocused) {
      setSignalHasUnread(false);
      return;
    }
    try {
      setSignalHasUnread(await refreshSignalUnreadFromServer());
    } catch {
      const cached = await loadSignalUnreadCached();
      if (cached !== null) setSignalHasUnread(cached);
    }
  }, [signalTabFocused]);

  const refreshDisclosureUnreadBadge = useCallback(async () => {
    if (!hasSignalApi()) {
      setDisclosureHasUnread(false);
      return;
    }
    if (disclosureTabFocused) {
      setDisclosureHasUnread(false);
      return;
    }
    try {
      setDisclosureHasUnread(await refreshDisclosureUnreadFromServer());
    } catch {
      const cached = await loadDisclosureUnreadCached();
      if (cached !== null) setDisclosureHasUnread(cached);
    }
  }, [disclosureTabFocused]);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const startPolling = async () => {
      const minutes = await loadNewsUnreadCheckIntervalMinutes();
      if (cancelled) return;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        void refreshNewsUnreadBadge();
        void refreshSignalUnreadBadge();
        void refreshDisclosureUnreadBadge();
      }, newsUnreadCheckIntervalMs(minutes));
    };

    void loadNewsUnreadCached().then((cached) => {
      if (cached === true && !newsTabFocused) setNewsHasUnread(true);
    });
    void refreshNewsUnreadBadge();
    void refreshSignalUnreadBadge();
    void loadDisclosureUnreadCached().then((cached) => {
      if (cached === true) setDisclosureHasUnread(true);
    });
    void refreshDisclosureUnreadBadge();
    void startPolling();

    const unsubscribeSeen = subscribeNewsSeenChanged(() => void refreshNewsUnreadBadge());
    const unsubscribeSignalSeen = subscribeSignalSeenChanged(() => void refreshSignalUnreadBadge());
    const unsubscribeDisclosureSeen = subscribeDisclosureSeenChanged(() => void refreshDisclosureUnreadBadge());
    const unsubscribeInterval = subscribeNewsUnreadCheckIntervalChanged(() => {
      void startPolling();
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshNewsUnreadBadge();
        void refreshSignalUnreadBadge();
        void refreshDisclosureUnreadBadge();
      }
    });
    return () => {
      cancelled = true;
      unsubscribeSeen();
      unsubscribeSignalSeen();
      unsubscribeDisclosureSeen();
      unsubscribeInterval();
      if (pollTimer) clearInterval(pollTimer);
      appStateSub.remove();
    };
  }, [newsTabFocused, refreshNewsUnreadBadge, refreshSignalUnreadBadge, refreshDisclosureUnreadBadge]);

  useEffect(() => {
    void loadSignalUnreadCached().then((cached) => {
      if (cached === true && !signalTabFocused) setSignalHasUnread(true);
    });
    void refreshSignalUnreadBadge();
  }, [refreshSignalUnreadBadge, signalTabFocused]);

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
        /** Web FlatList/ScrollView need a bounded flex column from the tab scene downward. */
        ...(webTabSceneStyle ? { sceneStyle: webTabSceneStyle } : null),
        /** 탭 복귀 시 화면이 비는(react-native-screens freeze) 경우 완화 */
        freezeOnBlur: false,
        /** Web: lazy-mount tabs to avoid rendering every feed at once. Native phone keeps eager mount. */
        lazy: isWeb,
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

  // iPad wide 레이아웃: 좌측 사이드바 + 콘텐츠 (탭바 숨김)
  const iPadScreenOptions = useMemo(
    (): BottomTabNavigationOptions => ({
      ...screenOptions,
      tabBarStyle: { display: 'none' },
      /** Sidebar switches tabs explicitly — only mount the active screen. */
      lazy: true,
    }),
    [screenOptions],
  );

  if (isWideLayout) {
    return (
      <IpadSidebarNavProvider>
        <IpadWideTabLayout
          iPadScreenOptions={iPadScreenOptions}
          newsHasUnread={newsHasUnread}
          signalHasUnread={signalHasUnread}
          disclosureHasUnread={disclosureHasUnread}
          t={t}
        />
      </IpadSidebarNavProvider>
    );
  }

  return (
    <Tabs
      initialRouteName="home"
      tabBar={isWeb ? undefined : (props) => <SignalFloatingTabBar {...props} />}
      screenOptions={screenOptions}
      detachInactiveScreens={isWeb}>
      {/* 순서: 홈 · 뉴스 · 시그널 · 시세 · 더보기. 공시·유튜브는 더보기 허브에서 진입한다. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} />,
        }}
      />
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
        name="disclosures"
        options={{
          href: null,
          title: t('tabDisclosures'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="file-alt" color={color} focused={focused} showDot={disclosureHasUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="signal"
        options={{
          title: t('tabSignal'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="highlighter" color={color} focused={focused} showDot={signalHasUnread} />
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
        name="more"
        options={{
          title: t('tabMore'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="th-large" color={color} focused={focused} showDot={disclosureHasUnread} />
          ),
        }}
      />
      <Tabs.Screen
        name="youtube"
        options={{
          title: t('tabYoutube'),
          href: null,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="youtube" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}

const sidebarLayoutStyles = StyleSheet.create({
  safe: {
    ...webFlexFill,
  },
  body: {
    ...webFlexFill,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  content: {
    ...webSidebarContentStyle,
  },
  paneFill: {
    ...webSidebarPaneFill,
  },
  tabsHost: {
    ...webTabNavigatorHostStyle,
  },
});

type IpadWideTabLayoutProps = {
  iPadScreenOptions: BottomTabNavigationOptions;
  newsHasUnread: boolean;
  signalHasUnread: boolean;
  disclosureHasUnread: boolean;
  t: ReturnType<typeof useLocale>['t'];
};

function IpadWideTabLayout({
  iPadScreenOptions,
  newsHasUnread,
  signalHasUnread,
  disclosureHasUnread,
  t,
}: IpadWideTabLayoutProps) {
  const { contentPane, newsIssuesParams, showHome } = useIpadSidebarNav();
  const { theme } = useSignalTheme();

  return (
    <SafeAreaView style={[sidebarLayoutStyles.safe, { backgroundColor: theme.bg }]} edges={['top']}>
      <SignalHeader compact fullWidth />
      <View style={[sidebarLayoutStyles.body, { backgroundColor: theme.bg }]}>
        <SignalSidebarTabBar
          newsHasUnread={newsHasUnread}
          signalHasUnread={signalHasUnread}
          disclosureHasUnread={disclosureHasUnread}
        />
        <View style={[sidebarLayoutStyles.content, { backgroundColor: theme.bg }]}>
          {contentPane === 'home' ? (
            <View style={sidebarLayoutStyles.paneFill}>
              <IpadHomeScreen />
            </View>
          ) : contentPane === 'newsIssues' && newsIssuesParams ? (
            <View style={sidebarLayoutStyles.paneFill}>
              <NewsIssuesContent
                embedded
                initialCategory={newsIssuesParams.category}
                initialDate={newsIssuesParams.date}
                initialDigestId={newsIssuesParams.digestId}
                onBack={showHome}
              />
            </View>
          ) : contentPane === 'account' ? (
            <View style={sidebarLayoutStyles.paneFill}>
              <AccountScreen embedded />
            </View>
          ) : contentPane === 'settings' ? (
            <View style={sidebarLayoutStyles.paneFill}>
              <SettingsScreen embedded />
            </View>
          ) : (
            <View style={sidebarLayoutStyles.tabsHost}>
              <Tabs
                initialRouteName="news"
                tabBar={() => null}
                screenOptions={iPadScreenOptions}
                detachInactiveScreens>
              <Tabs.Screen name="index" options={{ href: null }} />
              <Tabs.Screen name="home" options={{ href: null }} />
              <Tabs.Screen name="news" options={{ title: t('tabNews') }} />
              <Tabs.Screen name="disclosures" options={{ href: null, title: t('tabDisclosures') }} />
              <Tabs.Screen name="signal" options={{ title: t('tabSignal') }} />
              <Tabs.Screen name="quotes" options={{ title: t('tabQuotes') }} />
              <Tabs.Screen name="more" options={{ title: t('tabMore') }} />
              <Tabs.Screen name="youtube" options={{ title: t('tabYoutube') }} />
              </Tabs>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
