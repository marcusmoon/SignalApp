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
import { tabBarBottomInset } from '@/constants/tabBar';
import type { MoreHubRouteKey } from '@/constants/moreHubOrder';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
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

const GRID_GAP = 12;
const TILE_HEIGHT = 54;
/** 허브 행 ↔ 하단 링크·광고 등 섹션 사이 */
const SECTION_GAP = 14;

export default function MoreHubScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { useTwoPane, isIOS, isPad } = useResponsiveLayout();
  const showIpadQuickLinks = useTwoPane;
  const useTwoColumnHub = isIOS && !isPad && !useTwoPane;
  const styles = useMemo(
    () => makeStyles(theme, scaleFont, useTwoColumnHub),
    [theme, scaleFont, useTwoColumnHub],
  );
  const [order, setOrder] = useState<MoreHubRouteKey[]>([]);
  const [orderReady, setOrderReady] = useState(false);
  const [refLinksVisible, setRefLinksVisible] = useState(true);

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
        router.push('/(tabs)/disclosures' as never);
        return;
      }
      if (item === 'board') {
        router.push('/(tabs)/board' as never);
        return;
      }
      if (item === 'youtube') {
        router.push({ pathname: '/(tabs)/youtube', params: { from: 'more' } } as never);
        return;
      }
      if (item === 'account') {
        router.push({ pathname: '/account', params: { from: 'more' } } as never);
        return;
      }
      router.push({ pathname: '/settings', params: { from: 'sidebar', tab: 'display' } } as never);
    },
    [router, useTwoPane],
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
        ? order.filter((item) => item !== 'account' && item !== 'youtube' && item !== 'settings' && item !== 'board')
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
          key={useTwoColumnHub ? 'more-grid' : 'more-list'}
          data={showIpadQuickLinks ? [] : visibleOrder}
          keyExtractor={(item) => item}
          numColumns={useTwoColumnHub ? 2 : 1}
          columnWrapperStyle={useTwoColumnHub ? styles.gridRow : undefined}
          scrollEnabled
          style={[styles.list, useTwoPane && styles.listWide]}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: 24 + tabBarHeight + tabBarBottomInset(insets.bottom),
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
            return (
              <Pressable
                onPress={() => openHubItem(item)}
                style={({ pressed }) => [
                  styles.tile,
                  useTwoColumnHub && styles.tileGrid,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={name}>
                <View style={styles.iconCircle}>
                  <FontAwesome name={meta.icon} size={18} color={theme.green} />
                </View>
                <Text
                  style={[styles.rowTitle, useTwoColumnHub && styles.gridTitle]}
                  numberOfLines={useTwoColumnHub ? 2 : 2}>
                  {name}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, twoColumn: boolean) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
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
      marginBottom: twoColumn ? 0 : GRID_GAP,
    },
    tileGrid: {
      flex: 1,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 88,
      paddingVertical: 12,
      paddingHorizontal: 8,
      gap: 8,
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
    rowTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(17),
    },
    gridTitle: {
      flex: 0,
      textAlign: 'center',
      fontSize: sf(12),
      lineHeight: sf(16),
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
