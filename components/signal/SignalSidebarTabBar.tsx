/**
 * iPad 전용 좌측 사이드바 내비게이션.
 * - 메인 탭(홈·뉴스·공시·시장·시세·유튜브·게시판·더보기)을 세로로 표시
 * - 설정 세부 항목·퀵 링크와 계정 진입점을 iPad에 맞게 분리
 */
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIDEBAR_WIDTH } from '@/constants/responsiveLayout';
import { SCREEN_SIDEBAR_SUBTAB_MARGIN_BOTTOM } from '@/constants/segmentTabBar';
import { isSettingsTab, SETTINGS_TABS, type SettingsTab } from '@/constants/settingsTabs';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav, type YoutubeSortKey } from '@/contexts/IpadSidebarNavContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import type { MessageId } from '@/locales/messages';

type TabDef = {
  name: string;
  route: string;
  icon: 'newspaper' | 'file-alt' | 'chart-area' | 'chart-line' | 'youtube' | 'comments' | 'th-large';
  labelId: MessageId;
};

type SidebarSubDef = {
  key: string;
  kind: 'settings' | 'navigate' | 'youtube';
  route: string;
  icon:
    | 'youtube'
    | 'external-link-alt'
    | 'palette'
    | 'bell'
    | 'newspaper'
    | 'chart-line'
    | 'server'
    | 'list'
    | 'fire';
  labelId: MessageId;
  params?: Record<string, string>;
};

const SIDEBAR_TABS: TabDef[] = [
  { name: 'news', route: '/(tabs)/news', icon: 'newspaper', labelId: 'tabNews' },
  { name: 'signal', route: '/(tabs)/signal', icon: 'chart-area', labelId: 'tabSignal' },
  { name: 'quotes', route: '/(tabs)/quotes', icon: 'chart-line', labelId: 'tabQuotes' },
  { name: 'disclosures', route: '/(tabs)/disclosures', icon: 'file-alt', labelId: 'tabDisclosures' },
  { name: 'youtube', route: '/(tabs)/youtube', icon: 'youtube', labelId: 'tabYoutube' },
  { name: 'board', route: '/(tabs)/board', icon: 'comments', labelId: 'screenBoard' },
  { name: 'more', route: '/(tabs)/more', icon: 'th-large', labelId: 'tabMore' },
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

const SETTINGS_SUB_TABS: SidebarSubDef[] = SETTINGS_TABS.map((item) => ({
  key: item.key,
  kind: 'settings',
  route: '/settings',
  icon:
    item.key === 'display'
      ? 'palette'
      : item.key === 'notifications'
        ? 'bell'
        : item.key === 'news'
          ? 'newspaper'
          : item.key === 'quotes'
            ? 'chart-line'
            : 'server',
  labelId: item.labelId,
}));

const MORE_SUB_TABS: SidebarSubDef[] = [
  ...SETTINGS_SUB_TABS,
  {
    key: 'quick',
    kind: 'navigate',
    route: '/(tabs)/more',
    icon: 'external-link-alt',
    labelId: 'moreRefLinksKicker',
    params: { section: 'quick' },
  },
];

const MORE_AUX_PATHS = ['/alerts', '/calendar'];

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
  const params = useLocalSearchParams<{ section?: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const { subTabs, activeSubTabKey } = useSidebarSubTabs();
  const ipadNav = useIpadSidebarNav();

  const accountActive = pathname.startsWith('/account') || ipadNav.isAccountPaneActive;
  const homeActive = ipadNav.isHomePaneActive && !accountActive && !ipadNav.isSettingsPaneActive;
  const settingsTabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeSettingsSubKey: SettingsTab | null = ipadNav.isSettingsPaneActive
    ? ipadNav.settingsTab
    : pathname.startsWith('/settings')
      ? isSettingsTab(settingsTabParam)
        ? settingsTabParam
        : 'display'
      : null;

  const activeTabName = accountActive
    ? null
    : homeActive
      ? null
      : ipadNav.isSettingsPaneActive || pathname.startsWith('/settings')
      ? 'more'
      : MORE_AUX_PATHS.some((path) => pathname.startsWith(path))
        ? 'more'
        : SIDEBAR_TABS.find(
            (tab) =>
              pathname.startsWith(`/${tab.name}`) || pathname === tab.route.replace('/(tabs)', ''),
          )?.name ?? 'news';

  const activeMoreSubKey =
    activeTabName === 'more'
      ? activeSettingsSubKey || (params.section === 'quick' || !params.section ? 'quick' : null)
      : null;
  const activeYoutubeSubKey: YoutubeSortKey | null =
    activeTabName === 'youtube' && ipadNav.isAvailable ? ipadNav.youtubeSort : null;

  const styles = makeStyles(theme, scaleFont, insets.bottom);

  const navigateMainTab = (tab: TabDef) => {
    if (tab.name === 'youtube') {
      if (ipadNav.isAvailable) {
        ipadNav.showYoutubeTab('latest');
      }
      ipadNav.showTabs();
      router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
      return;
    }
    ipadNav.showTabs();
    router.navigate(tab.route as Parameters<typeof router.navigate>[0]);
  };

  const renderSubTabs = (items: SidebarSubDef[], activeKey: string | null) => (
    <View style={styles.subTabList}>
      {items.map((sub) => {
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
              if (sub.kind === 'settings' && ipadNav.isAvailable) {
                ipadNav.showSettings(sub.key as SettingsTab);
                return;
              }
              if (sub.kind === 'youtube' && ipadNav.isAvailable) {
                const sortKey = sub.key as YoutubeSortKey;
                ipadNav.showYoutubeTab(sortKey);
                router.navigate({
                  pathname: sub.route,
                  params: { sort: sortKey === 'latest' ? undefined : sortKey },
                } as Parameters<typeof router.navigate>[0]);
                return;
              }
              ipadNav.showTabs();
              router.navigate(
                sub.params
                  ? ({ pathname: sub.route, params: sub.params } as Parameters<typeof router.navigate>[0])
                  : (sub.route as Parameters<typeof router.navigate>[0]),
              );
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
            onPress={() => ipadNav.showHome()}
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
              (tab.name === 'disclosures' && disclosureHasUnread) ||
              (tab.name === 'more' && disclosureHasUnread);

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

                {isActive && tab.name === 'youtube'
                  ? renderSubTabs(YOUTUBE_SUB_TABS, activeYoutubeSubKey)
                  : null}
                {isActive && tab.name === 'more' ? renderSubTabs(MORE_SUB_TABS, activeMoreSubKey) : null}

                {isActive &&
                tab.name !== 'more' &&
                tab.name !== 'youtube' &&
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
                        onPress={sub.onPress}
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
      <View style={styles.accountDock}>
        <Pressable
          style={({ pressed }) => [
            styles.accountButton,
            accountActive && styles.accountButtonActive,
            pressed && styles.tabItemPressed,
          ]}
          onPress={() => {
            if (ipadNav.isAvailable) {
              ipadNav.showAccount();
              return;
            }
            router.navigate({ pathname: '/account', params: { from: 'sidebar' } } as never);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: accountActive }}
          accessibilityLabel={t('screenAccount')}>
          <View style={styles.iconWrap}>
            <FontAwesome5
              name="user-circle"
              size={18}
              color={accountActive ? theme.green : theme.textMuted}
              solid
            />
          </View>
          <Text style={[styles.tabLabel, accountActive && styles.tabLabelActive]} numberOfLines={1}>
            {t('screenAccount')}
          </Text>
        </Pressable>
      </View>
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
    accountDock: {
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: Math.max(12, bottomInset + 8),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    accountButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
    },
    accountButtonActive: {
      backgroundColor: theme.bgElevated,
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
      fontWeight: '800',
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
