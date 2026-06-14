import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReferenceLinksSection } from '@/components/more/ReferenceLinksSection';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { tabBarBottomInset } from '@/constants/tabBar';
import type { MoreHubRouteKey } from '@/constants/moreHubOrder';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
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
  youtube: { href: '/youtube' as Href, icon: 'youtube-play', titleId: 'tabYoutube' },
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
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
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

  const listFooter = useMemo(
    () => (
      <View style={styles.footer}>
        {refLinksVisible ? <ReferenceLinksSection /> : null}
        <SignalBannerAd variant="large" style={styles.footerAd} />
      </View>
    ),
    [refLinksVisible, styles.footer, styles.footerAd],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader compact onBrandPress={onHeaderRefresh} />
      {isFocused ? <OtaUpdateBanner /> : null}
      {!orderReady ? (
        <View style={styles.loadingPad}>
          <Text style={styles.muted}>{t('commonLoading')}</Text>
        </View>
      ) : (
        <FlatList
          key="more-grid"
          data={order}
          numColumns={2}
          keyExtractor={(item) => item}
          scrollEnabled
          style={styles.list}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: 24 + tabBarHeight + tabBarBottomInset(insets.bottom),
          }}
          columnWrapperStyle={styles.gridRow}
          ListFooterComponent={listFooter}
          renderItem={({ item }) => {
            const meta = HUB_META[item];
            const name = t(meta.titleId);
            return (
              <Pressable
                onPress={() => router.push(meta.href)}
                style={({ pressed }) => [
                  styles.tile,
                  pressed && styles.rowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={name}>
                <View style={styles.iconCircle}>
                  <FontAwesome name={meta.icon} size={18} color={theme.green} />
                </View>
                <Text style={styles.rowTitle} numberOfLines={2}>
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

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    list: { flex: 1, paddingHorizontal: 16 },
    loadingPad: { padding: 24 },
    muted: { fontSize: sf(14), color: theme.textDim },
    gridRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    tile: {
      flex: 1,
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
    footer: {
      marginTop: SECTION_GAP,
      gap: SECTION_GAP,
    },
    footerAd: {
      marginTop: 0,
    },
  });
}
