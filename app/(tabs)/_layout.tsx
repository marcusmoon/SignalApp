import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, View, type ColorValue } from 'react-native';
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
import { webTabNavigatorHostStyle, webTabSceneStyle, webFlexFill, webSidebarContentStyle, webShellBackground } from '@/constants/webLayout';
import {
  GlassSurfaceBackground,
  colorWithAlpha,
  glassEdgeColors,
} from '@/components/signal/GlassSurface';
import { SignalFloatingTabBar } from '@/components/signal/SignalFloatingTabBar';
import { AppQuickActions } from '@/components/AppQuickActions';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalSidebarTabBar } from '@/components/signal/SignalSidebarTabBar';
import { SlackTabBarButton } from '@/components/SlackTabBarButton';
import AccountScreen from '@/app/account';
import { NewsIssuesContent } from '@/app/news-issues';
import { DisclosureFlowContent } from '@/app/disclosure-flow';
import SettingsScreen from '@/app/settings';
import { IpadHomeScreen } from '@/components/signal/IpadHomeScreen';
import { useFeedUnreadBadges } from '@/contexts/FeedUnreadBadgesContext';
import { IpadSidebarNavProvider, useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  loadTabBarOpacityLevel,
  subscribeTabBarOpacityChanged,
  tabBarOpacityForLevel,
  type TabBarOpacityLevel,
} from '@/services/tabBarOpacityPreference';

const TAB_ICON_SIZE = 25;

type TabBarIconName = 'home' | 'newspaper' | 'file-alt' | 'chart-line' | 'chart-area' | 'youtube' | 'th-large' | 'comments';

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
  const { t } = useLocale();
  const insets = useSafeAreaInsets();
  const { isWideLayout } = useResponsiveLayout();
  const {
    newsTabBadge,
    signalTabBadge,
    disclosureTabBadge,
    moreTabBadge,
  } = useFeedUnreadBadges();
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
      /** Wide sidebar: eager mount — lazy + detach blanked the right pane on web. */
      lazy: false,
    }),
    [screenOptions],
  );

  if (isWideLayout) {
    return (
      <IpadSidebarNavProvider>
        <IpadWideTabLayout
          iPadScreenOptions={iPadScreenOptions}
          newsTabBadge={newsTabBadge}
          signalTabBadge={signalTabBadge}
          disclosureTabBadge={disclosureTabBadge}
          t={t}
        />
      </IpadSidebarNavProvider>
    );
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
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: t('tabNews'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="newspaper" color={color} focused={focused} showDot={newsTabBadge} />
          ),
        }}
      />
      <Tabs.Screen
        name="disclosures"
        options={{
          href: null,
          title: t('tabDisclosures'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="file-alt" color={color} focused={focused} showDot={disclosureTabBadge} />
          ),
        }}
      />
      <Tabs.Screen
        name="signal"
        options={{
          title: t('tabSignal'),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="chart-area" color={color} focused={focused} showDot={signalTabBadge} />
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
            <TabBarIcon name="th-large" color={color} focused={focused} showDot={moreTabBadge} />
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
      <Tabs.Screen
        name="board"
        options={{
          title: t('screenBoard'),
          href: null,
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="comments" color={color} focused={focused} />,
        }}
      />
    </Tabs>
      <AppQuickActions />
    </>
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
  newsTabBadge: boolean;
  signalTabBadge: boolean;
  disclosureTabBadge: boolean;
  t: ReturnType<typeof useLocale>['t'];
};

function IpadWideTabLayout({
  iPadScreenOptions,
  newsTabBadge,
  signalTabBadge,
  disclosureTabBadge,
  t,
}: IpadWideTabLayoutProps) {
  const { contentPane, newsIssuesParams, disclosureFlowParams, showHome } = useIpadSidebarNav();
  const { theme } = useSignalTheme();

  return (
    <>
      <SafeAreaView style={[sidebarLayoutStyles.safe, { backgroundColor: webShellBackground(theme.bg) }]} edges={['top']}>
      <SignalHeader compact fullWidth />
      <View style={[sidebarLayoutStyles.body, { backgroundColor: webShellBackground(theme.bg) }]}>
        <SignalSidebarTabBar
          newsHasUnread={newsTabBadge}
          signalHasUnread={signalTabBadge}
          disclosureHasUnread={disclosureTabBadge}
        />
        <View style={[sidebarLayoutStyles.content, { backgroundColor: webShellBackground(theme.bg) }]}>
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
                  onBack={showHome}
                />
              ) : contentPane === 'disclosureFlow' && disclosureFlowParams ? (
                <DisclosureFlowContent
                  embedded
                  initialDate={disclosureFlowParams.date}
                  initialMarket={disclosureFlowParams.market}
                  initialDigestId={disclosureFlowParams.digestId}
                  onBack={showHome}
                />
              ) : contentPane === 'account' ? (
                <AccountScreen embedded />
              ) : contentPane === 'settings' ? (
                <SettingsScreen embedded />
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
              <Tabs.Screen name="youtube" options={{ title: t('tabYoutube') }} />
              <Tabs.Screen name="board" options={{ href: null, title: t('screenBoard') }} />
            </Tabs>
          </View>
        </View>
      </View>
    </SafeAreaView>
      <AppQuickActions />
    </>
  );
}
