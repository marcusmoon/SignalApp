import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { Pressable as GHPressable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReferenceLinksSection } from '@/components/more/ReferenceLinksSection';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { TAB_BAR_FLOAT_MARGIN_BOTTOM } from '@/constants/tabBar';
import type { MoreHubRouteKey } from '@/constants/moreHubOrder';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { formatMessage, type MessageId } from '@/locales/messages';
import {
  loadMoreHubOrder,
  saveMoreHubOrder,
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
  briefing: { href: '/briefing', icon: 'briefcase', titleId: 'screenBriefing' },
};

const ROW_GAP = 10;
const ROW_HEIGHT = 76;
const MORE_HUB_LIST_HEIGHT = ROW_HEIGHT + 16;

export default function MoreHubScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t } = useLocale();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [order, setOrder] = useState<MoreHubRouteKey[]>([]);
  const [orderReady, setOrderReady] = useState(false);
  const [refLinksVisible, setRefLinksVisible] = useState(true);
  const canReorder = order.length > 1;

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

  const listFooter = useMemo(
    () => (
      <View>
        {refLinksVisible ? <ReferenceLinksSection /> : null}
        <SignalBannerAd />
      </View>
    ),
    [refLinksVisible],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <SignalHeader />
      {isFocused ? <OtaUpdateBanner /> : null}
      {!orderReady ? (
        <View style={styles.loadingPad}>
          <Text style={styles.muted}>{t('commonLoading')}</Text>
        </View>
      ) : (
        <DraggableFlatList
          data={order}
          keyExtractor={(item) => item}
          scrollEnabled
          removeClippedSubviews={false}
          style={styles.list}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: 24 + tabBarHeight + TAB_BAR_FLOAT_MARGIN_BOTTOM,
          }}
          ListFooterComponent={listFooter}
          containerStyle={{ flex: 1 }}
          onDragEnd={({ data }) => {
            if (!canReorder) return;
            setOrder(data);
            void saveMoreHubOrder(data);
          }}
          renderItem={({ item, drag, isActive, getIndex }) => {
            const meta = HUB_META[item];
            const idx = getIndex() ?? 0;
            const isLast = idx === order.length - 1;
            const name = t(meta.titleId);
            return (
              <ScaleDecorator>
                <View
                  style={[
                    styles.rowWrap,
                    !isLast && styles.rowWrapGap,
                    isActive && styles.rowWrapActive,
                  ]}>
                  <Pressable
                    onPress={() => router.push(meta.href)}
                    style={styles.rowMain}
                    accessibilityRole="button"
                    accessibilityLabel={name}>
                    <View style={styles.iconCircle}>
                      <FontAwesome name={meta.icon} size={20} color={theme.green} />
                    </View>
                    <Text style={styles.rowTitle}>{name}</Text>
                    <FontAwesome name="chevron-right" size={14} color={theme.textDim} />
                  </Pressable>
                  {canReorder ? (
                    <GHPressable
                      style={styles.dragHandle}
                      {...(Platform.OS === 'web'
                        ? { onPressIn: drag }
                        : { onLongPress: drag, delayLongPress: 200 })}
                      accessibilityRole="button"
                      accessibilityLabel={formatMessage(t('moreHubSegmentDragHandleA11y'), { name })}>
                      <FontAwesome name="bars" size={16} color={theme.textMuted} />
                    </GHPressable>
                  ) : null}
                </View>
              </ScaleDecorator>
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
    rowWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      minHeight: ROW_HEIGHT,
      paddingRight: 6,
    },
    rowWrapGap: { marginBottom: ROW_GAP },
    rowWrapActive: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.greenBorder,
    },
    rowMain: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingLeft: 14,
      paddingRight: 8,
      minHeight: ROW_HEIGHT - 2,
    },
    dragHandle: {
      width: 44,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconCircle: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    rowTitle: {
      flex: 1,
      fontSize: sf(16),
      fontWeight: '800',
      color: theme.text,
    },
  });
}
