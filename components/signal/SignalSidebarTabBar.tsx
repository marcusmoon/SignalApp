/**
 * iPad·웹 좌측 사이드바 내비게이션.
 * - 메인 탭(홈·뉴스·시장·시세·공시·유튜브·게시판·내 정보)
 * - 설정은 내 정보 허브에서 진입 (More 탭 없음)
 * - 퀵 링크는 하단 슬림 도크
 */
import { usePathname, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SidebarReferenceLinksDock } from '@/components/more/SidebarReferenceLinksDock';
import { SIDEBAR_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM } from '@/constants/segmentTabBar';
import { UI_FONT_WEIGHT_EMPHASIS } from '@/constants/uiFontWeight';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav, type YoutubeSortKey } from '@/contexts/IpadSidebarNavContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import type { MessageId } from '@/locales/messages';
import {
  loadMoreReferenceLinksVisible,
  subscribeMoreReferenceLinksVisibilityChanged,
} from '@/services/moreReferenceLinksPreference';

type TabDef = {
  name: string;
  route: string;
  icon:
    | 'newspaper'
    | 'file-alt'
    | 'chart-area'
    | 'chart-line'
    | 'youtube'
    | 'comments'
    | 'user-circle';
  labelId: MessageId;
};

type SidebarSubDef = {
  key: string;
  kind: 'youtube';
  route: string;
  icon: 'list' | 'fire';
  labelId: MessageId;
};

const SIDEBAR_TABS: TabDef[] = [
  { name: 'news', route: '/(tabs)/news', icon: 'newspaper', labelId: 'tabNews' },
  { name: 'signal', route: '/(tabs)/signal', icon: 'chart-area', labelId: 'tabSignal' },
  { name: 'quotes', route: '/(tabs)/quotes', icon: 'chart-line', labelId: 'tabQuotes' },
  { name: 'disclosures', route: '/(tabs)/disclosures', icon: 'file-alt', labelId: 'tabDisclosures' },
  { name: 'youtube', route: '/(tabs)/youtube', icon: 'youtube', labelId: 'tabYoutube' },
  { name: 'board', route: '/(tabs)/board', icon: 'comments', labelId: 'screenBoard' },
  { name: 'account', route: '/account', icon: 'user-circle', labelId: 'screenAccount' },
];

const YOUTUBE_SUB_TABS: SidebarSubDef[] = [
  {
    key: 'latest',
    kind: 'youtube',
    route: '/(tabs)/youtube',
    icon: 'list',
    labelId: 'youtubeSortLatest',
  },
  {
    key: 'popular',
    kind: 'youtube',
    route: '/(tabs)/youtube',
    icon: 'fire',
    labelId: 'youtubeSortPopular',
  },
];

/** 내 정보에서 진입하는 보조 화면 — 사이드바에서는 내 정보 활성으로 표시 */
const ACCOUNT_AUX_PATHS = ['/alerts', '/calendar', '/settings', '/terms', '/terms-history'];

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
  newsHasUnread?: boolean;
  signalHasUnread?: boolean;
  disclosureHasUnread?: boolean;
};

export function SignalSidebarTabBar({
  newsHasUnread = false,
  signalHasUnread = false,
  disclosureHasUnread = false,
}: Props) {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { subTabs, activeSubTabKey } = useSidebarSubTabs();
  const ipadNav = useIpadSidebarNav();
  const [refLinksVisible, setRefLinksVisible] = useState(true);

  const reloadRefLinksPref = useCallback(async () => {
    setRefLinksVisible(await loadMoreReferenceLinksVisible());
  }, []);

  useEffect(() => {
    void reloadRefLinksPref();
    return subscribeMoreReferenceLinksVisibilityChanged(() => {
      void reloadRefLinksPref();
    });
  }, [reloadRefLinksPref]);

  const accountActive =
    pathname.startsWith('/account') ||
    ipadNav.isAccountPaneActive ||
    ipadNav.isSettingsPaneActive ||
    ACCOUNT_AUX_PATHS.some((path) => pathname.startsWith(path));
  const homeActive = ipadNav.isHomePaneActive && !accountActive;

  const activeTabName = accountActive
    ? 'account'
    : homeActive
      ? null
      : SIDEBAR_TABS.find(
          (tab) =>
            tab.name !== 'account' &&
            (pathname.startsWith(`/${tab.name}`) || pathname === tab.route.replace('/(tabs)', '')),
        )?.name ?? 'news';

  const activeYoutubeSubKey: YoutubeSortKey | null =
    activeTabName === 'youtube' && ipadNav.isAvailable ? ipadNav.youtubeSort : null;

  const styles = makeStyles(theme, scaleFont, insets.bottom);

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
    if (activeTabName === tab.name) {
      if (ipadNav.isAvailable) ipadNav.showTabs();
      return;
    }
    if (tab.name === 'youtube') {
      if (ipadNav.isAvailable) {
        // 현재 정렬 유지 (사이드바 메인 클릭이 latest로 리셋하지 않음)
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

  const renderYoutubeSubTabs = (activeKey: string | null) => (
    <View style={styles.subTabList}>
      {YOUTUBE_SUB_TABS.map((sub) => {
        const subActive = activeKey === sub.key;
        return (
          <Pressable
            key={sub.key}
            style={({ pressed }) => [
              styles.subTabItem,
              subActive && styles.subTabItemActive,
              pressed && styles.subTabItemPressed,
            ]}
            onPress={() => {
              if (!ipadNav.isAvailable) return;
              if (activeYoutubeSubKey === sub.key) return;
              ipadNav.showYoutubeTab(sub.key as YoutubeSortKey);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: subActive }}>
            <View style={styles.subIconWrap}>
              <FontAwesome5
                name={sub.icon}
                size={12}
                color={subActive ? theme.green : theme.textDim}
                solid
              />
            </View>
            <Text style={[styles.subTabLabel, subActive && styles.subTabLabelActive]} numberOfLines={1}>
              {t(sub.labelId)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

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
              if (homeActive) return;
              ipadNav.showHome();
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: homeActive }}>
            <View style={styles.iconWrap}>
              <FontAwesome5
                name="home"
                size={18}
                color={homeActive ? theme.green : theme.textMuted}
                solid
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
                    <FontAwesome5
                      name={tab.icon}
                      size={18}
                      color={isActive ? theme.green : theme.textMuted}
                      solid
                    />
                    {hasDot ? <View style={styles.dot} /> : null}
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
                    {t(tab.labelId)}
                  </Text>
                </Pressable>

                {isActive && tab.name === 'youtube' ? renderYoutubeSubTabs(activeYoutubeSubKey) : null}

                {isActive && tab.name !== 'youtube' && tab.name !== 'account' && subTabs.length > 0 ? (
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
      backgroundColor: '#F04452',
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
