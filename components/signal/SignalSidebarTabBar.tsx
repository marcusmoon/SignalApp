/**
 * iPad 전용 좌측 사이드바 내비게이션.
 * - 메인 탭(뉴스·공시·시그널·시세·더보기)을 세로로 표시
 * - SidebarSubTabsContext에 등록된 서브탭을 현재 탭 아래에 표시
 */
import { usePathname, useRouter } from 'expo-router';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIDEBAR_WIDTH } from '@/constants/responsiveLayout';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import type { MessageId } from '@/locales/messages';

type TabDef = {
  name: string;
  route: string;
  icon: 'newspaper' | 'file-alt' | 'highlighter' | 'chart-line' | 'th-large' | 'youtube';
  labelId: MessageId;
  dotColor?: string | null;
};

const SIDEBAR_TABS: TabDef[] = [
  { name: 'news',        route: '/(tabs)/news',        icon: 'newspaper',   labelId: 'tabNews' },
  { name: 'disclosures', route: '/(tabs)/disclosures', icon: 'file-alt',    labelId: 'tabDisclosures' },
  { name: 'signal',      route: '/(tabs)/signal',      icon: 'highlighter', labelId: 'tabSignal' },
  { name: 'quotes',      route: '/(tabs)/quotes',      icon: 'chart-line',  labelId: 'tabQuotes' },
  { name: 'youtube',     route: '/(tabs)/youtube',     icon: 'youtube',     labelId: 'tabYoutube' },
  { name: 'more',        route: '/(tabs)/more',        icon: 'th-large',    labelId: 'tabMore' },
];

const MORE_AUX_PATHS = ['/account', '/settings', '/alerts', '/calendar'];

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
  const { subTabs } = useSidebarSubTabs();

  // 현재 활성 탭 이름 추출
  const activeTabName = MORE_AUX_PATHS.some((path) => pathname.startsWith(path))
    ? 'more'
    : SIDEBAR_TABS.find((tab) =>
        pathname.startsWith(`/${tab.name}`) || pathname === tab.route.replace('/(tabs)', ''),
      )?.name ?? 'news';

  const styles = makeStyles(theme, scaleFont, insets.bottom);

  return (
    <View style={styles.sidebar}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
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
                onPress={() => router.navigate(tab.route as Parameters<typeof router.navigate>[0])}
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
                <Text
                  style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                  numberOfLines={1}>
                  {t(tab.labelId)}
                </Text>
              </Pressable>

              {isActive && subTabs.length > 0 ? (
                <View style={styles.subTabList}>
                  {subTabs.map((sub) => (
                    <Pressable
                      key={sub.key}
                      style={({ pressed }) => [
                        styles.subTabItem,
                        sub.active && styles.subTabItemActive,
                        pressed && styles.subTabItemPressed,
                      ]}
                      onPress={sub.onPress}
                      accessibilityRole="button"
                      accessibilityState={{ selected: sub.active }}>
                      <View style={[styles.subTabDot, sub.active && styles.subTabDotActive]} />
                      <Text
                        style={[styles.subTabLabel, sub.active && styles.subTabLabelActive]}
                        numberOfLines={1}>
                        {sub.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
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
      paddingBottom: bottomInset,
      flexShrink: 0,
    },
    scroll: { flex: 1 },
    scrollContent: { paddingVertical: 12, paddingHorizontal: 8 },
    tabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 12,
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
      marginBottom: 6,
      paddingLeft: 18,
    },
    subTabItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
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
