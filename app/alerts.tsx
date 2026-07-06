import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { APP_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import {
  SCREEN_LIST_CONTENT_PADDING_TOP,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { webShellBackground } from '@/constants/webLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { loadAlertsFromServer, markAlertsSeen } from '@/services/alertsUnreadPreference';
import type { StoredNotification } from '@/services/notificationHistory';
import { hasSignalApi } from '@/services/env';
import { loadAppAuthSession, getSessionAccessToken, type StoredAppAuthSession } from '@/services/appAuthSession';
import { deleteSignalNotifications } from '@/integrations/signal-api/notifications';
import { clearSignalNotificationsCache } from '@/integrations/signal-api/cache/notificationsCache';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatRelativeTime } from '@/utils/date';

import { alertTypeMessageId, type AlertsFilter } from '@/domain/alerts/notificationCategory';
import { navigateToAlert, resolveAlertHref } from '@/domain/alerts/alertNavigation';

export default function AlertsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const [items, setItems] = useState<StoredNotification[]>([]);
  const [authSession, setAuthSession] = useState<StoredAppAuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AlertsFilter>('all');
  useResetRefreshingOnTabBlur(setRefreshing);

  const reload = useCallback(async (activeFilter: AlertsFilter = filter, forceRefresh = false) => {
    const savedSession = await loadAppAuthSession();
    setAuthSession(savedSession);
    setAuthChecked(true);
    const access = getSessionAccessToken(savedSession);
    if (!access) {
      setItems([]);
      return;
    }
    if (!hasSignalApi()) {
      setItems([]);
      return;
    }
    setItems(await loadAlertsFromServer(access, activeFilter, { cacheMode: signalCacheMode(forceRefresh) }));
  }, [filter]);

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        await reload();
        await markAlertsSeen();
      })();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload(filter, true);
    } finally {
      setRefreshing(false);
    }
  }, [filter, reload]);

  const alertFilters = useMemo(
    () =>
      [
        { key: 'all', label: t('alertsFilterAll') },
        { key: 'high', label: t('alertsFilterHigh') },
        { key: 'signal', label: t('alertsFilterSignal') },
        { key: 'system', label: t('alertsFilterSystem') },
      ] as const,
    [t],
  );

  const openNotificationSettings = useCallback(() => {
    router.push('/settings?tab=notifications');
  }, [router]);

  const settingsButton = useMemo(
    () => (
      <Pressable
        onPress={openNotificationSettings}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('alertsOpenSettings')}
        style={({ pressed }) => [styles.filterSettingsBtn, pressed && styles.filterSettingsBtnPressed]}>
        <FontAwesome name="cog" size={18} color={theme.textMuted} />
      </Pressable>
    ),
    [openNotificationSettings, styles.filterSettingsBtn, styles.filterSettingsBtnPressed, t, theme.textMuted],
  );

  const onDeleteAlert = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const access = getSessionAccessToken(authSession);
    if (access && hasSignalApi()) {
      await deleteSignalNotifications(access, { ids: [id] }).catch(() => {});
      clearSignalNotificationsCache();
    }
  }, [authSession]);

  const onDeleteAllAlerts = useCallback(() => {
    if (items.length === 0) return;
    Alert.alert(t('alertsDeleteAllConfirmTitle'), t('alertsDeleteAllConfirmBody'), [
      { text: t('commonCancel'), style: 'cancel' },
      {
        text: t('alertsSwipeDelete'),
        style: 'destructive',
        onPress: () => {
          const access = getSessionAccessToken(authSession);
          setItems([]);
          if (access && hasSignalApi()) {
            void deleteSignalNotifications(access, { all: true }).catch(() => {});
            clearSignalNotificationsCache();
          }
        },
      },
    ]);
  }, [authSession, items.length, t]);

  const filteredItems = items;

  const listEmptyMessage =
    items.length === 0 ? (filter === 'all' ? t('alertsEmpty') : t('alertsFilterEmpty')) : null;

  const listHeader = useMemo(
    () => (
      <>
        <View style={styles.filterRow}>
          <View style={styles.filterTabs} accessibilityRole="tablist">
            {alertFilters.map((item) => {
              const selected = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    setFilter(item.key);
                    void reload(item.key);
                  }}
                  style={[styles.filterTab, selected && styles.filterTabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}>
                  <Text style={[styles.filterTabText, selected && styles.filterTabTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {settingsButton}
        </View>
        {items.length > 0 ? (
          <View style={styles.listActionsRow}>
            <Pressable
              onPress={onDeleteAllAlerts}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('alertsDeleteAllA11y')}
              style={({ pressed }) => [styles.deleteAllBtn, pressed && styles.deleteAllBtnPressed]}>
              <Text style={styles.deleteAllText}>{t('alertsDeleteAll')}</Text>
            </Pressable>
          </View>
        ) : null}
      </>
    ),
    [alertFilters, filter, items.length, onDeleteAllAlerts, settingsButton, styles, t],
  );

  const onOpenAlert = useCallback(
    (item: StoredNotification) => {
      navigateToAlert(router, ipadNav, item);
    },
    [ipadNav, router],
  );

  const renderAlert = useCallback(
    ({ item: a }: { item: StoredNotification }) => {
      const href = resolveAlertHref(a);
      const typeLabel = t(alertTypeMessageId(a));
      const card = (
        <View style={styles.alertCard}>
          <View style={styles.alertTop}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{typeLabel}</Text>
            </View>
            {a.high ? (
              <View style={styles.high}>
                <Text style={styles.highText}>{t('alertsHighBadge')}</Text>
              </View>
            ) : (
              <Text style={styles.time}>{formatRelativeTime(a.receivedAt, locale)}</Text>
            )}
          </View>
          <Text style={styles.alertTitle}>{a.title}</Text>
          <Text style={styles.alertBody}>{a.body}</Text>
          {a.high ? <Text style={styles.timeRight}>{formatRelativeTime(a.receivedAt, locale)}</Text> : null}
        </View>
      );

      return (
        <ReanimatedSwipeable
          overshootRight={false}
          containerStyle={styles.swipeRow}
          renderRightActions={() => (
            <View style={styles.swipeRight}>
              <RectButton
                style={styles.swipeDeleteBtn}
                onPress={() => void onDeleteAlert(a.id)}
                accessibilityRole="button"
                accessibilityLabel={t('alertsSwipeDeleteA11y', { title: a.title })}>
                <Text style={styles.swipeDeleteText}>{t('alertsSwipeDelete')}</Text>
              </RectButton>
            </View>
          )}>
          {href ? (
            <Pressable
              onPress={() => onOpenAlert(a)}
              style={({ pressed }) => [pressed && styles.alertCardPressed]}
              accessibilityRole="button"
              accessibilityLabel={`${typeLabel}. ${a.title}`}>
              {card}
            </Pressable>
          ) : (
            card
          )}
        </ReanimatedSwipeable>
      );
    },
    [locale, onDeleteAlert, onOpenAlert, styles, t],
  );

  const bottomPad = stackScreenScrollBottomPadding(insets.bottom);

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.loadingCenter} accessibilityRole="progressbar" accessibilityLabel={t('commonLoadingA11y')}>
          <ActivityIndicator color={theme.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (authChecked && !getSessionAccessToken(authSession)) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <View style={[styles.authGate, { paddingBottom: bottomPad }]}>
          <View style={styles.authGateTopBar}>{settingsButton}</View>
          <View style={styles.authGateCard}>
            <Text style={styles.authGateKicker}>{t('screenAlerts')}</Text>
            <Text style={styles.authGateTitle}>{t('alertsLoginRequiredTitle')}</Text>
            <Text style={styles.authGateBody}>{t('alertsLoginRequiredBody')}</Text>
            <Pressable
              onPress={() => router.push('/account')}
              style={styles.authGateButton}
              accessibilityRole="button"
              accessibilityLabel={t('alertsLoginRequiredButton')}>
              <Text style={styles.authGateButtonText}>{t('alertsLoginRequiredButton')}</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={filteredItems}
        keyExtractor={(a) => a.id}
        renderItem={renderAlert}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          listEmptyMessage ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{listEmptyMessage}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad },
          filteredItems.length === 0 ? styles.listContentEmpty : null,
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={12}
        windowSize={7}
      />
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    list: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    listContentEmpty: { flexGrow: 1 },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 14,
    },
    filterTabs: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterSettingsBtn: {
      minWidth: 36,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 0,
    },
    filterSettingsBtnPressed: { opacity: 0.65 },
    filterTab: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterTabActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    filterTabText: { fontSize: sf(12), fontWeight: '800', color: theme.textMuted },
    filterTabTextActive: { color: theme.green },
    listActionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: 10,
    },
    deleteAllBtn: {
      minHeight: 32,
      paddingHorizontal: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteAllBtnPressed: { opacity: 0.65 },
    deleteAllText: { fontSize: sf(12), fontWeight: '800', color: theme.textDim },
    candidateSection: {
      marginBottom: 14,
      padding: 14,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    candidateHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 4,
    },
    candidateTitle: { flex: 1, fontSize: sf(14), fontWeight: '900', color: theme.text },
    candidateLink: { fontSize: sf(12), fontWeight: '800', color: theme.green },
    candidateHint: { fontSize: sf(11), color: theme.textMuted, lineHeight: sf(16), marginBottom: 10 },
    candidateCard: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      marginTop: 8,
    },
    candidateCardPressed: { opacity: 0.78 },
    candidateMetaRow: {
      marginTop: 9,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 10,
    },
    candidateMeta: { flexShrink: 1, fontSize: sf(11), color: theme.textDim, fontWeight: '700' },
    emptyBox: {
      paddingVertical: 24,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 12,
    },
    emptyText: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20) },
    alertCard: {
      backgroundColor: theme.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    alertCardPressed: { opacity: 0.78 },
    swipeRow: {
      marginBottom: 10,
      borderRadius: 12,
      overflow: 'hidden',
    },
    swipeRight: {
      width: 80,
      height: '100%',
    },
    swipeDeleteBtn: {
      flex: 1,
      backgroundColor: '#7A2E2E',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 8,
    },
    swipeDeleteText: {
      color: '#FFFFFF',
      fontSize: sf(15),
      fontWeight: '800',
    },
    alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    typeBadge: {
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
    },
    typeBadgeText: { fontSize: sf(10), fontWeight: '900', color: theme.green },
    alertTitle: { fontSize: sf(13), fontWeight: '700', color: theme.text, marginBottom: 6 },
    alertBody: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    time: { fontSize: sf(11), color: theme.textDim },
    timeRight: { fontSize: sf(11), color: theme.textDim, marginTop: 6 },
    high: {
      backgroundColor: '#FF3B3B22',
      borderWidth: 1,
      borderColor: '#FF3B3B44',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    highText: { fontSize: sf(10), fontWeight: '900', color: '#FF6B6B' },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    authGate: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
    authGateTopBar: { alignItems: 'flex-end', marginBottom: 12 },
    authGateCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      padding: 18,
      gap: 10,
    },
    authGateKicker: { color: theme.green, fontSize: sf(11), fontWeight: '900' },
    authGateTitle: { color: theme.text, fontSize: sf(21), lineHeight: sf(27), fontWeight: '900' },
    authGateBody: { color: theme.textMuted, fontSize: sf(13), lineHeight: sf(19) },
    authGateButton: {
      minHeight: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.green,
      marginTop: 4,
    },
    authGateButtonText: { color: '#06100B', fontSize: sf(14), fontWeight: '900' },
  });
}
