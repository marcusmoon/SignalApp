import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { type Href, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReferenceLinksSection } from '@/components/more/ReferenceLinksSection';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { webShellBackground } from '@/constants/webLayout';
import type { MoreHubRouteKey } from '@/constants/moreHubOrder';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useDisclosureUnreadBadge } from '@/hooks/useDisclosureUnreadBadge';
import type { MessageId } from '@/locales/messages';
import {
  loadMoreHubOrder,
  subscribeMoreHubOrderChanged,
} from '@/services/moreHubOrderPreference';
import {
  loadMoreReferenceLinksVisible,
  subscribeMoreReferenceLinksVisibilityChanged,
} from '@/services/moreReferenceLinksPreference';

const HUB_META: Record<
  MoreHubRouteKey,
  { href: Href; icon: ComponentProps<typeof FontAwesome>['name']; titleId: MessageId }
> = {
  board: { href: '/(tabs)/board' as Href, icon: 'comments', titleId: 'screenBoard' },
  disclosures: { href: '/(tabs)/disclosures' as Href, icon: 'file-text-o', titleId: 'tabDisclosures' },
  youtube: { href: '/(tabs)/youtube' as Href, icon: 'youtube-play', titleId: 'tabYoutube' },
  account: { href: '/account' as Href, icon: 'user-circle', titleId: 'screenAccount' },
  settings: { href: '/settings' as Href, icon: 'cog', titleId: 'screenSettings' },
};

const GRID_GAP = 8;
const TILE_HEIGHT = 54;
const LIST_HORIZONTAL_PAD = 32;
/** 2열 셀 폭이 이 값 이상이면 아이콘 옆(가로), 미만이면 아래(세로) */
const HUB_TILE_HORIZONTAL_MIN_WIDTH = 158;
/** 허브 행 ↔ 하단 링크·광고 등 섹션 사이 */
const SECTION_GAP = 10;

type HubTileLayout = 'list' | 'grid-row' | 'grid-stack';

function resolveHubTileLayout(useTwoColumnHub: boolean, cellWidth: number): HubTileLayout {
  if (!useTwoColumnHub) return 'list';
  return cellWidth >= HUB_TILE_HORIZONTAL_MIN_WIDTH ? 'grid-row' : 'grid-stack';
}

function hubCellWidthForScreen(width: number): number {
  const listInner = Math.min(width, APP_CONTENT_MAX_WIDTH) - LIST_HORIZONTAL_PAD;
  return Math.max(0, (listInner - GRID_GAP) / 2);
}

export default function MoreHubScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { width, useTwoPane, isIOS, isPad, isWeb } = useResponsiveLayout();
  const showIpadQuickLinks = useTwoPane;
  const useTwoColumnHub = !useTwoPane && ((isIOS && !isPad) || isWeb);
  const hubCellWidth = useMemo(() => hubCellWidthForScreen(width), [width]);
  const hubTileLayout = useMemo(
    () => resolveHubTileLayout(useTwoColumnHub, hubCellWidth),
    [hubCellWidth, useTwoColumnHub],
  );
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, hubTileLayout),
    [theme, scaleFont, hubTileLayout],
  );
  const [order, setOrder] = useState<MoreHubRouteKey[]>([]);
  const [orderReady, setOrderReady] = useState(false);
  const [refLinksVisible, setRefLinksVisible] = useState(true);
  const disclosureHasUnread = useDisclosureUnreadBadge();

  const hubHasUnread = useCallback(
    (item: MoreHubRouteKey) => item === 'disclosures' && disclosureHasUnread,
    [disclosureHasUnread],
  );

  const reloadOrder = useCallback(async () => {
    const o = await loadMoreHubOrder();
    setOrder(o);
    setOrderReady(true);
  }, []);

  const reloadRefLinksPref = useCallback(async () => {
    const v = await loadMoreReferenceLinksVisible();
    setRefLinksVisible(v);
  }, []);

  useEffect(() => {
    return subscribeMoreHubOrderChanged(() => {
      void reloadOrder();
    });
  }, [reloadOrder]);

  useEffect(() => {
    return subscribeMoreReferenceLinksVisibilityChanged(() => {
      void reloadRefLinksPref();
    });
  }, [reloadRefLinksPref]);

  useFocusEffect(
    useCallback(() => {
      void reloadOrder();
      void reloadRefLinksPref();
    }, [reloadOrder, reloadRefLinksPref]),
  );

  const onHeaderRefresh = useCallback(() => {
    void reloadOrder();
    void reloadRefLinksPref();
  }, [reloadOrder, reloadRefLinksPref]);

  const openHubItem = useCallback(
    (item: MoreHubRouteKey) => {
      if (!useTwoPane) {
        router.push(HUB_META[item].href);
        return;
      }
      if (item === 'disclosures') {
        if (ipadNav.isAvailable) {
          ipadNav.showTabs();
        }
        router.push('/(tabs)/disclosures' as never);
        return;
      }
      if (item === 'board') {
        if (ipadNav.isAvailable) {
          ipadNav.showTabs();
        }
        router.push('/(tabs)/board' as never);
        return;
      }
      if (item === 'youtube') {
        if (ipadNav.isAvailable) {
          ipadNav.showYoutubeTab('latest');
        }
        router.push({ pathname: '/(tabs)/youtube', params: { from: 'more' } } as never);
        return;
      }
      if (item === 'account') {
        router.push({ pathname: '/account', params: { from: 'more' } } as never);
        return;
      }
      router.push({ pathname: '/settings', params: { from: 'sidebar', tab: 'display' } } as never);
    },
    [ipadNav, router, useTwoPane],
  );

  const listFooter = useMemo(
    () => (
      <View style={styles.footer}>
        {refLinksVisible ? <ReferenceLinksSection /> : null}
        <SignalBannerAd variant="large" style={styles.footerAd} />
      </View>
    ),
    [refLinksVisible, styles.footer, styles.footerAd],
  );
  const visibleOrder = useMemo(
    () =>
      useTwoPane
        ? order.filter(
            (item) =>
              item !== 'account' &&
              item !== 'youtube' &&
              item !== 'settings' &&
              item !== 'board' &&
              item !== 'disclosures',
          )
        : order,
    [order, useTwoPane],
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      {!useTwoPane ? <SignalHeader compact onBrandPress={onHeaderRefresh} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}
      {!orderReady ? (
        <View style={styles.loadingPad}>
          <Text style={styles.muted}>{t('commonLoading')}</Text>
        </View>
      ) : (
        <WebWheelFlatList
          key={hubTileLayout === 'list' ? 'more-list' : `more-grid-${hubTileLayout}`}
          data={showIpadQuickLinks ? [] : visibleOrder}
          keyExtractor={(item) => item}
          numColumns={useTwoColumnHub ? 2 : 1}
          columnWrapperStyle={useTwoColumnHub ? styles.gridRow : undefined}
          scrollEnabled
          style={[styles.list, useTwoPane && styles.listWide]}
          contentContainerStyle={{
            paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
            paddingBottom: tabScreenScrollBottomPadding(tabBarHeight, insets.bottom),
          }}
          ListHeaderComponent={
            showIpadQuickLinks ? (
              <View style={styles.quickOnlyWrap}>
                {refLinksVisible ? <ReferenceLinksSection /> : null}
              </View>
            ) : null
          }
          ListFooterComponent={showIpadQuickLinks ? <SignalBannerAd variant="large" style={styles.footerAd} /> : listFooter}
          renderItem={({ item }) => {
            const meta = HUB_META[item];
            const name = t(meta.titleId);
            const hasUnread = hubHasUnread(item);
            const a11yLabel = hasUnread ? t('moreHubUnreadDisclosuresA11y', { name }) : name;
            return (
              <Pressable
                onPress={() => openHubItem(item)}
                style={({ pressed }) => [
                  styles.tile,
                  hubTileLayout === 'grid-row' && styles.tileGridRow,
                  hubTileLayout === 'grid-stack' && styles.tileGridStack,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={a11yLabel}>
                <View
                  style={[
                    styles.iconCircle,
                    hubTileLayout !== 'list' && styles.gridIconCircle,
                    styles.iconCircleWrap,
                  ]}>
                  <FontAwesome
                    name={meta.icon}
                    size={hubTileLayout === 'list' ? 18 : hubTileLayout === 'grid-row' ? 15 : 16}
                    color={theme.green}
                  />
                  {hasUnread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text
                  style={[
                    styles.rowTitle,
                    hubTileLayout === 'grid-row' && styles.gridTitleRow,
                    hubTileLayout === 'grid-stack' && styles.gridTitleStack,
                  ]}
                  numberOfLines={hubTileLayout === 'grid-stack' ? 2 : hubTileLayout === 'grid-row' ? 1 : 2}>
                  {name}
                </Text>
                {hasUnread && hubTileLayout !== 'grid-stack' ? (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{t('moreHubUnreadLabel')}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, hubTileLayout: HubTileLayout) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    list: {
      flex: 1,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
    },
    listWide: {
      ...wideContentFill,
    },
    loadingPad: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      padding: 24,
    },
    muted: { fontSize: sf(14), color: theme.textDim },
    gridRow: {
      flexDirection: 'row',
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      minHeight: TILE_HEIGHT,
      paddingVertical: 8,
      paddingHorizontal: 10,
      marginBottom: hubTileLayout === 'list' ? GRID_GAP : 0,
    },
    tileGridRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 46,
      paddingVertical: 6,
      paddingHorizontal: 8,
      gap: 7,
    },
    tileGridStack: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 72,
      paddingVertical: 8,
      paddingHorizontal: 6,
      gap: 6,
    },
    rowPressed: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.greenBorder,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    iconCircleWrap: {
      position: 'relative',
    },
    unreadDot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: '#F04452',
      borderWidth: 1.5,
      borderColor: theme.card,
    },
    unreadBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: '#F0445218',
      borderWidth: 1,
      borderColor: '#F0445240',
    },
    unreadBadgeText: {
      fontSize: sf(10),
      fontWeight: '900',
      color: '#F04452',
      letterSpacing: 0.2,
    },
    gridIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 8,
    },
    rowTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(17),
    },
    gridTitleRow: {
      fontSize: sf(12),
      lineHeight: sf(15),
    },
    gridTitleStack: {
      flex: 0,
      textAlign: 'center',
      fontSize: sf(11),
      lineHeight: sf(14),
    },
    footer: {
      marginTop: SECTION_GAP,
      gap: SECTION_GAP,
    },
    quickOnlyWrap: {
      marginBottom: SECTION_GAP,
    },
    footerAd: {
      marginTop: 0,
    },
  });
}
