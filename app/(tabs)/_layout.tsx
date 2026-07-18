import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarButtonProps, BottomTabNavigationOptions } from "expo-router/js-tabs";
import { BottomTabBarHeightContext } from 'expo-router/js-tabs';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TAB_BAR_FLOAT_HEIGHT,
  tabBarHorizontalMargin,
  tabBarPositionBottom,
  TAB_BAR_FLOAT_RADIUS,
} from '@/constants/tabBar';
import { webTabNavigatorHostStyle, webTabSceneStyle, webFlexFill, webShellBackground } from '@/constants/webLayout';
import {
  GlassSurfaceBackground,
  colorWithAlpha,
  glassEdgeColors,
} from '@/components/signal/GlassSurface';
import { AppQuickActions } from '@/components/AppQuickActions';
import { SignalFloatingTabBar } from '@/components/signal/SignalFloatingTabBar';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import AccountScreen from '@/app/account';
import AlertsScreen from '@/app/alerts';
import CalendarScreen from '@/app/calendar';
import { NewsIssuesContent } from '@/app/news-issues';
import { DisclosureFlowContent } from '@/app/disclosure-flow';
import SettingsScreen from '@/app/settings';
import TermsHistoryScreen from '@/app/terms-history';
import { TermsContent } from '@/app/terms';
import { TodayBriefingContent } from '@/app/today-briefing';
import { DigestDetailContent } from '@/components/signal/DigestDetailContent';
import { EtfInsightDetailContent } from '@/components/signal/EtfInsightDetailContent';
import { EtfInsightsListContent } from '@/app/etf-insights';
import { CommunityPostContent } from '@/app/community/[id]';
import { SymbolDetailContent } from '@/app/symbol/[ticker]';
import { BoardContent } from '@/components/community/BoardContent';
import { QuotesContent } from '@/components/quotes/QuotesContent';
import { IpadHomeScreen } from '@/components/signal/IpadHomeScreen';
import SignalScreen from '@/app/(tabs)/signal';
import { useFeedUnreadBadges } from '@/contexts/FeedUnreadBadgesContext';
import { useIpadSidebarNavActions, useIpadSidebarNavState } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  loadTabBarOpacityLevel,
  subscribeTabBarOpacityChanged,
  tabBarOpacityForLevel,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';

const TAB_ICON_SIZE = 22;

type TabBarIconKey =
  | 'home'
  | 'news'
  | 'signal'
  | 'quotes'
  | 'more'
  | 'disclosures'
  | 'board';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICON_PAIR: Record<TabBarIconKey, { outline: IoniconName; filled: IoniconName }> = {
  home: { outline: 'home-outline', filled: 'home' },
  news: { outline: 'newspaper-outline', filled: 'newspaper' },
  signal: { outline: 'pulse-outline', filled: 'pulse' },
  quotes: { outline: 'stats-chart-outline', filled: 'stats-chart' },
  more: { outline: 'ellipsis-horizontal-outline', filled: 'ellipsis-horizontal' },
  disclosures: { outline: 'document-text-outline', filled: 'document-text' },
  board: { outline: 'chatbubbles-outline', filled: 'chatbubbles' },
};

function TabBarIcon({
  icon,
  color,
  focused = false,
  showDot,
}: {
  icon: TabBarIconKey;
  color: ColorValue;
  focused?: boolean;
  showDot?: boolean;
}) {
  const { theme } = useSignalTheme();
  const pair = TAB_ICON_PAIR[icon];
  const name = focused ? pair.filled : pair.outline;
  return (
    <View style={tabIconWrap}>
      <Ionicons name={name} size={TAB_ICON_SIZE} color={color} />
      {showDot ? <View style={[tabIconDot, { backgroundColor: theme.danger }]} /> : null}
    </View>
  );
}

/** Badge subscription stays in this leaf so tab layout does not re-render on poll. */
function NewsTabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { newsTabBadge } = useFeedUnreadBadges();
  return <TabBarIcon icon="news" color={color} focused={focused} showDot={newsTabBadge} />;
}

function SignalTabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { signalTabBadge } = useFeedUnreadBadges();
  return <TabBarIcon icon="signal" color={color} focused={focused} showDot={signalTabBadge} />;
}

function DisclosureTabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { disclosureTabBadge } = useFeedUnreadBadges();
  return <TabBarIcon icon="disclosures" color={color} focused={focused} showDot={disclosureTabBadge} />;
}

function MoreTabBarIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
  const { moreTabBadge } = useFeedUnreadBadges();
  return <TabBarIcon icon="more" color={color} focused={focused} showDot={moreTabBadge} />;
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
};

export default function TabLayout() {
  const { theme, effectiveColorScheme } = useSignalTheme();
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { isWideLayout } = useResponsiveLayout();
  const [tabBarOpacityLevel, setTabBarOpacityLevel] = useState<TabBarOpacityLevel>(3);

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
          backgroundColor: tabBarBg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tabBarEdge.ring,
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
          fontWeight: Platform.OS === 'ios' ? '700' : '600',
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
        sceneStyle: {
          backgroundColor: webShellBackground(theme.bg),
          ...(webTabSceneStyle ?? {}),
        },
        /** Web: lazy-mount tabs to avoid rendering every feed at once. Native phone keeps eager mount. */
        lazy: isWeb,
        /** 탭 복귀 시 화면이 비는(react-native-screens freeze) 경우 완화 */
        freezeOnBlur: false,
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
      theme.bg,
      effectiveColorScheme,
    ],
  );

  // iPad wide 레이아웃: 좌측 사이드바 + 콘텐츠 (탭바 숨김)
  const iPadScreenOptions = useMemo(
    (): BottomTabNavigationOptions => ({
      ...screenOptions,
      tabBarStyle: { display: 'none' },
      /**
       * Wide: lazy-mount visited tabs only; freeze inactive trees.
       * Keep detachInactiveScreens=false — detach + lazy blanked the right pane on web.
       */
      lazy: true,
      freezeOnBlur: true,
    }),
    [screenOptions],
  );

  if (isWideLayout) {
    return <IpadWideTabLayout iPadScreenOptions={iPadScreenOptions} t={t} />;
  }

  return (
    <>
      <Tabs
      initialRouteName="home"
      tabBar={(props) => <SignalFloatingTabBar {...props} />}
      screenOptions={screenOptions}
      detachInactiveScreens={isWeb}>
      {/* 순서: 홈 · 뉴스 · 시장 · 시세 · 더보기. 공시·유튜브는 더보기 허브에서 진입한다. */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: t('tabHome'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon icon="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t('tabNews'),
          tabBarIcon: ({ color, focused }) => <NewsTabBarIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="disclosures"
        options={{
          href: null,
          title: t('tabDisclosures'),
          tabBarIcon: ({ color, focused }) => <DisclosureTabBarIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="signal"
        options={{
          title: t('tabSignal'),
          tabBarIcon: ({ color, focused }) => <SignalTabBarIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t('tabQuotes'),
          tabBarIcon: ({ color, focused }) => <TabBarIcon icon="quotes" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: t('tabMore'),
          tabBarIcon: ({ color, focused }) => <MoreTabBarIcon color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: t('screenBoard'),
          href: null,
          tabBarIcon: ({ color, focused }) => <TabBarIcon icon="board" color={color} focused={focused} />,
        }}
      />
    </Tabs>
      <AppQuickActions />
    </>
  );
}

const sidebarLayoutStyles = StyleSheet.create({
  root: {
    ...webFlexFill,
    position: 'relative',
  },
  contentPane: {
    flex: 1,
    minHeight: 0,
    maxHeight: '100%',
    overflow: 'hidden',
  },
  tabsHost: {
    ...webTabNavigatorHostStyle,
    overflow: 'hidden',
  },
  tabsHostVisible: {
    flex: 1,
    minHeight: 0,
    alignSelf: 'stretch',
  },
  /** Keep mounted tabs laid out (display:none breaks FlatList viewport + pagination on web). */
  tabsHostHidden: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0,
    pointerEvents: 'none',
    zIndex: -1,
  },
});

type IpadWideTabLayoutProps = {
  iPadScreenOptions: BottomTabNavigationOptions;
  t: ReturnType<typeof useLocale>['t'];
};

function IpadWideTabLayout({
  iPadScreenOptions,
  t,
}: IpadWideTabLayoutProps) {
  const {
    contentPane,
    newsIssuesParams,
    newsDigestId,
    disclosureFlowParams,
    disclosureDigestId,
    todayBriefingDate,
    marketBriefingParams,
    etfInsightId,
    etfInsightDate,
    communityPostId,
    symbolTicker,
    calendarFromAccount,
    alertsFromAccount,
    settingsFromAccount,
    termsType,
    termsFromHistory: _termsFromHistory,
    widePaneCanGoBack,
  } = useIpadSidebarNavState();
  const { goBackWidePane } = useIpadSidebarNavActions();
  const { theme } = useSignalTheme();
  const subpaneBack = widePaneCanGoBack ? goBackWidePane : undefined;

  return (
    <>
      <View style={[sidebarLayoutStyles.root, { backgroundColor: webShellBackground(theme.bg) }]}>
        {contentPane !== 'tabs' ? (
          <View style={sidebarLayoutStyles.contentPane}>
            {contentPane === 'home' ? (
              <IpadHomeScreen />
            ) : contentPane === 'newsIssues' && newsIssuesParams ? (
              <NewsIssuesContent
                embedded
                initialCategory={newsIssuesParams.category}
                initialDate={newsIssuesParams.date}
                initialDigestId={newsIssuesParams.digestId}
                hideDateNavigator={newsIssuesParams.hideDateNavigator === true}
                onBack={subpaneBack}
              />
            ) : contentPane === 'newsDigest' && newsDigestId ? (
              <DigestDetailContent
                embedded
                kind="news"
                id={newsDigestId}
                onBack={subpaneBack}
              />
            ) : contentPane === 'disclosureFlow' && disclosureFlowParams ? (
              <DisclosureFlowContent
                embedded
                initialDate={disclosureFlowParams.date}
                initialMarket={disclosureFlowParams.market}
                initialDigestId={disclosureFlowParams.digestId}
                onBack={subpaneBack}
              />
            ) : contentPane === 'disclosureDigest' && disclosureDigestId ? (
              <DigestDetailContent
                embedded
                kind="disclosure"
                id={disclosureDigestId}
                onBack={subpaneBack}
              />
            ) : contentPane === 'account' ? (
              <AccountScreen embedded />
            ) : contentPane === 'settings' ? (
              <SettingsScreen embedded fromAccount={settingsFromAccount} onBack={subpaneBack} />
            ) : contentPane === 'todayBriefing' && todayBriefingDate ? (
              <TodayBriefingContent embedded date={todayBriefingDate} onBack={subpaneBack} />
            ) : contentPane === 'marketBriefing' ? (
              <BottomTabBarHeightContext.Provider value={0}>
                <SignalScreen
                  embedded
                  onBack={subpaneBack}
                  initialSession={marketBriefingParams?.session ?? null}
                  initialDate={marketBriefingParams?.date ?? null}
                  hideDateNavigator={marketBriefingParams?.hideDateNavigator === true}
                />
              </BottomTabBarHeightContext.Provider>
            ) : contentPane === 'etfInsights' ? (
              <EtfInsightsListContent embedded onBack={subpaneBack} />
            ) : contentPane === 'etfInsight' ? (
              <EtfInsightDetailContent
                embedded
                id={etfInsightId}
                date={etfInsightDate}
                onBack={subpaneBack}
              />
            ) : contentPane === 'calendar' ? (
              <CalendarScreen
                embedded
                fromAccount={calendarFromAccount}
                onBack={subpaneBack}
              />
            ) : contentPane === 'alerts' ? (
              <AlertsScreen
                embedded
                fromAccount={alertsFromAccount}
                onBack={subpaneBack}
              />
            ) : contentPane === 'termsHistory' ? (
              <TermsHistoryScreen embedded onBack={subpaneBack} />
            ) : contentPane === 'terms' ? (
              <TermsContent
                embedded
                termsType={termsType}
                onBack={subpaneBack}
              />
            ) : contentPane === 'board' ? (
              <BoardContent embedded onBack={subpaneBack} active />
            ) : contentPane === 'community' && communityPostId ? (
              <CommunityPostContent embedded id={communityPostId} onBack={subpaneBack} />
            ) : contentPane === 'symbol' && symbolTicker ? (
              <SymbolDetailContent embedded ticker={symbolTicker} onBack={subpaneBack} />
            ) : contentPane === 'watchlist' ? (
              <BottomTabBarHeightContext.Provider value={0}>
                <QuotesContent embedded lockedSegment="watch" onBack={subpaneBack} />
              </BottomTabBarHeightContext.Provider>
            ) : null}
          </View>
        ) : null}
        <View
          style={[
            sidebarLayoutStyles.tabsHost,
            contentPane === 'tabs' ? sidebarLayoutStyles.tabsHostVisible : sidebarLayoutStyles.tabsHostHidden,
          ]}>
          <Tabs
            initialRouteName="news"
            tabBar={() => null}
            screenOptions={iPadScreenOptions}
            detachInactiveScreens={false}>
            <Tabs.Screen name="index" options={{ href: null }} />
            <Tabs.Screen name="home" options={{ href: null }} />
            <Tabs.Screen name="news" options={{ title: t('tabNews') }} />
            <Tabs.Screen name="disclosures" options={{ href: null, title: t('tabDisclosures') }} />
            <Tabs.Screen name="signal" options={{ title: t('tabSignal') }} />
            <Tabs.Screen name="quotes" options={{ title: t('tabQuotes') }} />
            <Tabs.Screen name="more" options={{ title: t('tabMore') }} />
            <Tabs.Screen name="board" options={{ href: null, title: t('screenBoard') }} />
          </Tabs>
        </View>
      </View>
      <AppQuickActions />
    </>
  );
}
