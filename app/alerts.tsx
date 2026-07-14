import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RectButton } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import { AccountSubpaneHeader } from '@/components/account/AccountSubpaneHeader';
import { IpadSidebarScreen } from '@/components/layout/IpadSidebarScreen';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  SCREEN_FIXED_HEADER_PADDING_BOTTOM,
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import { webShellBackground } from '@/constants/webLayout';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { SourceIconStack } from '@/components/signal/SourceIconStack';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange } from '@/hooks';
import { checkAlertsHasUnread, loadAlertsFromServer, markAlertsSeen } from '@/services/alertsUnreadPreference';
import type { StoredNotification } from '@/services/notificationHistory';
import { hasSignalApi } from '@/services/env';
import { loadAppAuthSession, getSessionAccessToken, type StoredAppAuthSession } from '@/services/appAuthSession';
import { deleteSignalNotifications } from '@/integrations/signal-api/notifications';
import { clearSignalNotificationsCache } from '@/integrations/signal-api/cache/notificationsCache';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatRelativeTime } from '@/utils/date';

import { alertTypeMessageId, type AlertsFilter } from '@/domain/alerts/notificationCategory';
import { notificationSourceIconEntries } from '@/domain/alerts/notificationSourceIcons';
import { navigateToAlert, resolveAlertHref } from '@/domain/alerts/alertNavigation';

export default function AlertsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const { useTwoPane } = useResponsiveLayout();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const fromAccount =
    (Array.isArray(params.from) ? params.from[0] : params.from) === 'account';

  const returnToAccountHub = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showAccount();
      return;
    }
    router.replace('/account' as never);
  }, [ipadNav, router]);

  const wrapWide = useCallback(
    (body: ReactNode) => {
      if (!useTwoPane) {
        return (
          <>
            <Stack.Screen options={{ title: t('screenAlerts') }} />
            {body}
          </>
        );
      }
      // 헤더·홈 진입: 전체 앱 크롬만. My info 진입: 본문 서브pane 헤더는 body에서 처리.
      return (
        <IpadSidebarScreen title={t('screenAlerts')} hideTopBar>
          {body}
        </IpadSidebarScreen>
      );
    },
    [t, useTwoPane],
  );
  const [items, setItems] = useState<StoredNotification[]>([]);
  const [authSession, setAuthSession] = useState<StoredAppAuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const [filter, setFilter] = useState<AlertsFilter>('all');
  const { ref: listRef } = useScrollToTopOnChange([filter], { resyncDeps: [items] });
  const listScrollResetKey = filter;
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
        setNewContentAvailable(false);
        await reload();
        await markAlertsSeen();
      })();
    }, [reload]),
  );

  /** 알림함 포커스 중 새 알림 도착 시 chip (탭 배지는 suppress로 숨김) */
  useEffect(() => {
    const access = getSessionAccessToken(authSession);
    if (!isFocused || !access || !hasSignalApi()) {
      setNewContentAvailable(false);
      return;
    }
    const POLL_MS = 3 * 60 * 1000;
    const poll = async () => {
      try {
        const hasUnread = await checkAlertsHasUnread();
        if (hasUnread) setNewContentAvailable(true);
      } catch {
        /* ignore polling errors */
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [authSession, isFocused]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    setNewContentAvailable(false);
    try {
      await reload(filter, true);
      await markAlertsSeen();
    } finally {
      setRefreshing(false);
    }
  }, [filter, reload]);

  const onRefresh = onRefreshBase;

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

  const notificationSettingsButton = useMemo(
    () => (
      <Pressable
        onPress={openNotificationSettings}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('alertsOpenSettings')}
        style={({ pressed }) => [styles.filterHeaderBtn, pressed && styles.filterHeaderBtnPressed]}>
        <FontAwesome name="cog" size={18} color={theme.textMuted} />
      </Pressable>
    ),
    [openNotificationSettings, styles, t, theme.textMuted],
  );

  const headerActions = useMemo(
    () => (
      <View style={styles.filterHeaderActions}>
        {items.length > 0 ? (
          <Pressable
            onPress={onDeleteAllAlerts}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('alertsDeleteAllA11y')}
            style={({ pressed }) => [styles.filterHeaderBtn, pressed && styles.filterHeaderBtnPressed]}>
            <FontAwesome name="trash-o" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
        {notificationSettingsButton}
      </View>
    ),
    [items.length, notificationSettingsButton, onDeleteAllAlerts, styles, t],
  );

  const onDeleteAlert = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    const access = getSessionAccessToken(authSession);
    if (access && hasSignalApi()) {
      await deleteSignalNotifications(access, { ids: [id] }).catch(() => {});
      clearSignalNotificationsCache();
    }
  }, [authSession]);

  const filteredItems = items;

  const listEmptyMessage =
    items.length === 0 ? (filter === 'all' ? t('alertsEmpty') : t('alertsFilterEmpty')) : null;

  const alertsTopFixed = useMemo(
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
          {headerActions}
        </View>
      </>
    ),
    [alertFilters, filter, headerActions, styles, t],
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
      const sourceEntries = notificationSourceIconEntries(a);
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
          {sourceEntries.length > 0 || a.high ? (
            <View style={styles.alertFooter}>
              {sourceEntries.length > 0 ? (
                <SourceIconStack sources={sourceEntries} size={18} maxVisible={4} />
              ) : (
                <View />
              )}
              {a.high ? <Text style={styles.timeRight}>{formatRelativeTime(a.receivedAt, locale)}</Text> : null}
            </View>
          ) : null}
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
    return wrapWide(
      <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
        <View style={styles.loadingCenter} accessibilityRole="progressbar" accessibilityLabel={t('commonLoadingA11y')}>
          <ActivityIndicator color={theme.green} />
        </View>
      </SafeAreaView>,
    );
  }

  if (authChecked && !getSessionAccessToken(authSession)) {
    return wrapWide(
      <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <View style={[styles.authGate, { paddingBottom: bottomPad }]}>
          {fromAccount ? (
            <View style={styles.subpaneHeaderPad}>
              <AccountSubpaneHeader title={t('screenAlerts')} onBack={returnToAccountHub} />
            </View>
          ) : null}
          <View style={styles.authGateTopBar}>{notificationSettingsButton}</View>
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
      </SafeAreaView>,
    );
  }

  return wrapWide(
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={[styles.mainColumn, useTwoPane && styles.mainColumnWide]}>
        {fromAccount ? (
          <View style={styles.subpaneHeaderPad}>
            <AccountSubpaneHeader title={t('screenAlerts')} onBack={returnToAccountHub} />
          </View>
        ) : null}
        <View style={[styles.topFixed, useTwoPane && styles.topFixedWide]}>{alertsTopFixed}</View>
        {isFocused ? (
          <FeedNewContentChip
            visible={newContentAvailable}
            refreshing={refreshing}
            message={t('feedNewContentAvailable')}
            onPress={() => void onRefresh()}
          />
        ) : null}
        <WebWheelFlatList
          scrollResetKey={listScrollResetKey}
          ref={listRef as never}
          data={filteredItems}
          keyExtractor={(a) => a.id}
          renderItem={renderAlert}
          ListEmptyComponent={
            listEmptyMessage ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>{listEmptyMessage}</Text>
              </View>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            useTwoPane && styles.listContentWide,
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
      </View>
    </SafeAreaView>,
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: webShellBackground(theme.bg) },
    mainColumn: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    mainColumnWide: {
      ...wideContentFill,
    },
    topFixed: fixedHeader.strip,
    topFixedWide: fixedHeader.stripWide,
    subpaneHeaderPad: {
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
    },
    list: {
      flex: 1,
      minHeight: 0,
    },
    listContent: { paddingHorizontal: 16, paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    listContentWide: { paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP },
    listContentEmpty: { flexGrow: 1 },
    filterRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    filterHeaderActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      flexShrink: 0,
    },
    filterHeaderBtn: {
      minWidth: 36,
      minHeight: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterHeaderBtnPressed: { opacity: 0.65 },
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
    filterTabText: { fontSize: sf(12), fontWeight: '600', color: theme.textMuted },
    filterTabTextActive: { color: theme.green },
    filterTabs: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 16,
    },
    candidateSection: {
      marginBottom: 14,
      padding: 14,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    candidateHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 4,
    },
    candidateTitle: { flex: 1, fontSize: sf(14), fontWeight: '700', color: theme.text },
    candidateLink: { fontSize: sf(12), fontWeight: '600', color: theme.green },
    candidateHint: { fontSize: sf(11), color: theme.textMuted, lineHeight: sf(16), marginBottom: 14 },
    candidateCard: {
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      marginTop: 8,
    },
    candidateCardPressed: { opacity: 0.78 },
    candidateMetaRow: {
      marginTop: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 16,
    },
    candidateMeta: { flexShrink: 1, fontSize: sf(11), color: theme.textDim, fontWeight: '700' },
    emptyBox: {
      paddingVertical: 24,
      paddingHorizontal: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      marginBottom: 16,
    },
    emptyText: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20) },
    alertCard: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 14,
    },
    alertCardPressed: { opacity: 0.78 },
    swipeRow: {
      marginBottom: 14,
      borderRadius: 8,
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
      fontWeight: '600',
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
    typeBadgeText: { fontSize: sf(10), fontWeight: '700', color: theme.green },
    alertTitle: { fontSize: sf(13), fontWeight: '700', color: theme.text, marginBottom: 6 },
    alertBody: { fontSize: sf(12), color: theme.textMuted, lineHeight: sf(18) },
    alertFooter: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minWidth: 0,
    },
    time: { fontSize: sf(11), color: theme.textDim },
    timeRight: { fontSize: sf(11), color: theme.textDim },
    high: {
      backgroundColor: '#FF3B3B22',
      borderWidth: 1,
      borderColor: '#FF3B3B44',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    highText: { fontSize: sf(10), fontWeight: '700', color: '#FF6B6B' },
    loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    authGate: { flex: 1, justifyContent: 'center', paddingHorizontal: 16 },
    authGateTopBar: { alignItems: 'flex-end', marginBottom: 16 },
    authGateCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      padding: 18,
      gap: 16,
    },
    authGateKicker: { color: theme.green, fontSize: sf(11), fontWeight: '700' },
    authGateTitle: { color: theme.text, fontSize: sf(21), lineHeight: sf(27), fontWeight: '700' },
    authGateBody: { color: theme.textMuted, fontSize: sf(13), lineHeight: sf(19) },
    authGateButton: {
      minHeight: 44,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.green,
      marginTop: 4,
    },
    authGateButtonText: { color: '#06100B', fontSize: sf(14), fontWeight: '700' },
  });
}
