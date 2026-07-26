/**
 * iPad·웹 좌측 사이드바 내비게이션.
 * - 메인 탭(홈·뉴스·시장·시세·공시·섹터·스크리너·게시판·게임·내 정보)
 * - 설정은 내 정보 허브에서 진입 (More 탭 없음)
 * - 퀵 링크는 하단 슬림 도크
 */
import { usePathname, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SidebarReferenceLinksDock } from '@/components/more/SidebarReferenceLinksDock';
import { SIDEBAR_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM } from '@/constants/segmentTabBar';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useFeedUnreadBadges } from '@/contexts/FeedUnreadBadgesContext';
import {
  useIpadSidebarNavActions,
  useIpadSidebarNavState,
} from '@/contexts/IpadSidebarNavContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import type { MessageId } from '@/locales/messages';
import {
  loadMoreReferenceLinksVisible,
  subscribeMoreReferenceLinksVisibilityChanged,
} from '@/services/moreReferenceLinksPreference';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

type TabDef = {
  name: string;
  route: string;
  iconOutline: IoniconName;
  iconFilled: IoniconName;
  labelId: MessageId;
};

const SIDEBAR_TABS: TabDef[] = [
  {
    name: 'news',
    route: '/(tabs)/news',
    iconOutline: 'newspaper-outline',
    iconFilled: 'newspaper',
    labelId: 'tabNews',
  },
  {
    name: 'signal',
    route: '/(tabs)/signal',
    iconOutline: 'pulse-outline',
    iconFilled: 'pulse',
    labelId: 'tabSignal',
  },
  {
    name: 'quotes',
    route: '/(tabs)/quotes',
    iconOutline: 'stats-chart-outline',
    iconFilled: 'stats-chart',
    labelId: 'tabQuotes',
  },
  {
    name: 'disclosures',
    route: '/(tabs)/disclosures',
    iconOutline: 'document-text-outline',
    iconFilled: 'document-text',
    labelId: 'tabDisclosures',
  },
  {
    name: 'etfBriefing',
    route: '/etf-insights',
    iconOutline: 'pie-chart-outline',
    iconFilled: 'pie-chart',
    labelId: 'moreHubEtfShort',
  },
  {
    name: 'screener',
    route: '/screener',
    iconOutline: 'filter-outline',
    iconFilled: 'filter',
    labelId: 'moreHubScreener',
  },
  {
    name: 'board',
    route: '/(tabs)/board',
    iconOutline: 'chatbubbles-outline',
    iconFilled: 'chatbubbles',
    labelId: 'screenBoard',
  },
  {
    name: 'gameCenter',
    route: '/game-center',
    iconOutline: 'game-controller-outline',
    iconFilled: 'game-controller',
    labelId: 'screenGameCenter',
  },
  {
    name: 'account',
    route: '/account',
    iconOutline: 'person-circle-outline',
    iconFilled: 'person-circle',
    labelId: 'screenAccount',
  },
];

/** 내 정보에서 진입하는 보조 화면 — 사이드바에서는 내 정보 활성으로 표시 */
const ACCOUNT_AUX_PATHS = ['/alerts', '/calendar', '/settings', '/terms', '/terms-history'];

let cachedRefLinksVisible: boolean | null = null;

function resolveTabNameFromHref(href: string): string | null {
  const fromTabs = href.match(/\/\(tabs\)\/([^/?]+)/);
  if (fromTabs?.[1]) return fromTabs[1];
  const fromRoot = href.match(/^\/([^/?]+)/);
  return fromRoot?.[1] ?? null;
}

function isCurrentTabHref(href: string, pathname: string, activeTabName: string | null): boolean {
  const name = resolveTabNameFromHref(href);
  if (!name) return false;
  if (activeTabName === name) return true;
  return pathname.startsWith(`/${name}`) || pathname === href.replace('/(tabs)', '');
}

type Props = {
  /** Optional overrides — default reads from FeedUnreadBadgesContext. */
  newsHasUnread?: boolean;
  signalHasUnread?: boolean;
  disclosureHasUnread?: boolean;
};

export function SignalSidebarTabBar({
  newsHasUnread: newsHasUnreadProp,
  signalHasUnread: signalHasUnreadProp,
  disclosureHasUnread: disclosureHasUnreadProp,
}: Props = {}) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { subTabs, activeSubTabKey, owner, setActiveSubTabKey } = useSidebarSubTabs();
  const ipadState = useIpadSidebarNavState();
  const ipadNav = useIpadSidebarNavActions();
  const badges = useFeedUnreadBadges();
  const newsHasUnread = newsHasUnreadProp ?? badges.newsTabBadge;
  const signalHasUnread = signalHasUnreadProp ?? badges.signalTabBadge;
  const disclosureHasUnread = disclosureHasUnreadProp ?? badges.disclosureTabBadge;
  const [refLinksVisible, setRefLinksVisible] = useState(cachedRefLinksVisible ?? true);

  const reloadRefLinksPref = useCallback(async () => {
    const visible = await loadMoreReferenceLinksVisible();
    cachedRefLinksVisible = visible;
    setRefLinksVisible(visible);
  }, []);

  useEffect(() => {
    void reloadRefLinksPref();
    return subscribeMoreReferenceLinksVisibilityChanged(() => {
      void reloadRefLinksPref();
    });
  }, [reloadRefLinksPref]);

  const accountActive =
    pathname.startsWith('/account') ||
    ipadState.isAccountPaneActive ||
    ipadState.isSettingsPaneActive ||
    ACCOUNT_AUX_PATHS.some((path) => pathname.startsWith(path));
  const etfActive =
    ipadState.contentPane === 'etfInsights' || ipadState.contentPane === 'etfInsight';
  const boardActive =
    ipadState.contentPane === 'board' || ipadState.contentPane === 'community';
  const gameCenterActive =
    pathname.startsWith('/game-center') || pathname.startsWith('/games/');
  const screenerActive = pathname.startsWith('/screener');
  const homeActive =
    ipadState.isHomePaneActive &&
    !accountActive &&
    !etfActive &&
    !boardActive &&
    !gameCenterActive &&
    !screenerActive;

  const activeTabName = accountActive
    ? 'account'
    : etfActive
      ? 'etfBriefing'
      : screenerActive
        ? 'screener'
        : boardActive
          ? 'board'
          : gameCenterActive
            ? 'gameCenter'
            : homeActive
              ? null
              : SIDEBAR_TABS.find(
                  (tab) =>
                    tab.name !== 'account' &&
                    tab.name !== 'etfBriefing' &&
                    tab.name !== 'screener' &&
                    tab.name !== 'board' &&
                    tab.name !== 'gameCenter' &&
                    (pathname.startsWith(`/${tab.name}`) ||
                      pathname === tab.route.replace('/(tabs)', '')),
                )?.name ?? 'news';

  const styles = useMemo(() => makeStyles(theme, scaleFont, insets.bottom), [theme, scaleFont, insets.bottom]);

  const navigateMainTab = (tab: TabDef) => {
    if (tab.name === 'account') {
      if (accountActive) return;
      if (ipadNav.isAvailable) {
        ipadNav.showAccount();
        return;
      }
      router.navigate({ pathname: '/account', params: { from: 'sidebar' } } as never);
      return;
    }
    if (tab.name === 'etfBriefing') {
      if (ipadState.contentPane === 'etfInsights') return;
      if (ipadNav.isAvailable) {
        // Top-level sidebar root — no drill back (same as account).
        ipadNav.showEtfInsights();
        return;
      }
      router.navigate('/etf-insights' as never);
      return;
    }
    if (tab.name === 'screener') {
      if (pathname.startsWith('/screener')) return;
      if (ipadNav.isAvailable) {
        ipadNav.showTabs();
      }
      router.navigate('/screener' as never);
      return;
    }
    if (tab.name === 'board') {
      if (ipadState.contentPane === 'board') return;
      if (ipadNav.isAvailable) {
        // Overlay root so post → back returns to board list (not a stray tabs pane).
        ipadNav.showBoard();
        return;
      }
      router.navigate('/(tabs)/board' as never);
      return;
    }
    if (tab.name === 'gameCenter') {
      if (pathname.startsWith('/game-center') && !pathname.startsWith('/games/')) return;
      if (ipadNav.isAvailable) {
        ipadNav.showTabs();
      }
      router.navigate('/game-center' as never);
      return;
    }
    if (activeTabName === tab.name) {
      if (ipadNav.isAvailable) ipadNav.showTabs();
      return;
    }
    if (tab.name === 'youtube') {
      if (ipadNav.isAvailable) {
        ipadNav.showYoutubeTab();
        return;
      }
      ipadNav.showTabs();
      router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
      return;
    }
    ipadNav.showTabs();
    router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
  };

  const handleSubPress = (sub: (typeof subTabs)[number]) => {
    if (sub.key === activeSubTabKey) return;

    // 화면 effect 경합과 무관하게 즉시 하이라이트.
    if (owner) setActiveSubTabKey(owner, sub.key);

    const onSameTab = sub.href ? isCurrentTabHref(sub.href, pathname, activeTabName) : false;

    if (onSameTab) {
      // 같은 화면: onPress만 — navigate + setParams + onPress 중복을 피한다.
      sub.onPress?.();
      return;
    }

    if (sub.href) {
      ipadNav.showTabs();
      const rawParams = sub.params ?? {};
      const setParams = Object.fromEntries(
        Object.entries(rawParams).filter(([, value]) => value != null && value !== ''),
      );
      const clearParams = Object.fromEntries(
        Object.entries(rawParams)
          .filter(([, value]) => value == null || value === '')
          .map(([key]) => [key, undefined]),
      );
      router.navigate({
        pathname: sub.href,
        params: setParams,
      } as Parameters<typeof router.navigate>[0]);
      // navigate만으로는 이전 쿼리가 남을 수 있어 기본값 키는 명시적으로 지운다.
      if (Object.keys(clearParams).length > 0) {
        router.setParams(clearParams);
      }
      return;
    }

    sub.onPress?.();
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.navArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <Pressable
            style={({ pressed }) => [
              styles.tabItem,
              homeActive && styles.tabItemActive,
              pressed && styles.tabItemPressed,
            ]}
            onPress={() => {
              // Highlight covers home drills (news/disclosure flow, etc.); still allow reset to home root.
              if (homeActive && ipadState.contentPane === 'home') return;
              ipadNav.showHome();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: homeActive }}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={homeActive ? 'home' : 'home-outline'}
                size={18}
                color={homeActive ? theme.green : theme.textMuted}
              />
            </View>
            <Text style={[styles.tabLabel, homeActive && styles.tabLabelActive]} numberOfLines={1}>
              {t('tabHome')}
            </Text>
          </Pressable>

          {SIDEBAR_TABS.map((tab) => {
            const isActive = activeTabName === tab.name;
            const hasDot =
              (tab.name === 'news' && newsHasUnread) ||
              (tab.name === 'signal' && signalHasUnread) ||
              (tab.name === 'disclosures' && disclosureHasUnread);

            return (
              <View key={tab.name}>
                <Pressable
                  style={({ pressed }) => [
                    styles.tabItem,
                    isActive && styles.tabItemActive,
                    pressed && styles.tabItemPressed,
                  ]}
                  onPress={() => navigateMainTab(tab)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}>
                  <View style={styles.iconWrap}>
                    <Ionicons
                      name={isActive ? tab.iconFilled : tab.iconOutline}
                      size={18}
                      color={isActive ? theme.green : theme.textMuted}
                    />
                    {hasDot ? <View style={styles.dot} /> : null}
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                    {t(tab.labelId)}
                  </Text>
                </Pressable>

                {isActive &&
                tab.name !== 'youtube' &&
                tab.name !== 'account' &&
                tab.name !== 'etfBriefing' &&
                tab.name !== 'screener' &&
                tab.name !== 'gameCenter' &&
                subTabs.length > 0 ? (
                  <View style={styles.subTabList}>
                    {subTabs.map((sub) => {
                      const subActive = activeSubTabKey === sub.key;
                      return (
                        <Pressable
                          key={sub.key}
                          style={({ pressed }) => [
                            styles.subTabItem,
                            subActive && styles.subTabItemActive,
                            pressed && styles.subTabItemPressed,
                          ]}
                          onPress={() => handleSubPress(sub)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: subActive }}>
                          <View style={[styles.subTabDot, subActive && styles.subTabDotActive]} />
                          <Text
                            style={[styles.subTabLabel, subActive && styles.subTabLabelActive]}
                            numberOfLines={1}>
                            {sub.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </View>
      {refLinksVisible ? (
        <View style={styles.quickLinksDock}>
          <SidebarReferenceLinksDock />
        </View>
      ) : (
        <View style={styles.quickLinksDockEmpty} />
      )}
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useSignalTheme>['theme'],
  sf: (n: number) => number,
  bottomInset: number,
) {
  return StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      backgroundColor: theme.card,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: theme.border,
      flexShrink: 0,
    },
    navArea: { flex: 1, minHeight: 0 },
    scroll: { flex: 1 },
    scrollContent: { paddingVertical: 12, paddingHorizontal: 8 },
    quickLinksDock: {
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: Math.max(12, bottomInset + 8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    quickLinksDockEmpty: {
      paddingBottom: Math.max(12, bottomInset + 8),
    },
    tabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      marginBottom: 4,
    },
    tabItemActive: {
      backgroundColor: theme.bgElevated,
    },
    tabItemPressed: { opacity: 0.75 },
    iconWrap: {
      width: 22,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    dot: {
      position: 'absolute',
      top: -2,
      right: -4,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: theme.danger,
    },
    tabLabel: {
      flex: 1,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.textMuted,
    },
    tabLabelActive: {
      color: theme.green,
      fontWeight: UI_FONT_WEIGHT_EMPHASIS,
    },
    subTabList: {
      marginBottom: SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM,
      paddingLeft: 18,
    },
    subTabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 8,
      marginBottom: 2,
    },
    subTabItemActive: {
      backgroundColor: theme.greenDim,
    },
    subTabItemPressed: { opacity: 0.75 },
    subTabDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.border,
    },
    subTabDotActive: {
      backgroundColor: theme.green,
    },
    subIconWrap: {
      width: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    subTabLabel: {
      flex: 1,
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
    },
    subTabLabelActive: {
      color: theme.green,
      fontWeight: '700',
    },
  });
}
