import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Stack, useRouter, type Href } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { loadNotificationHistory, type StoredNotification } from '@/services/notificationHistory';
import { loadNotificationPrefs } from '@/services/notificationPreferences';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { hasSignalApi } from '@/services/env';
import { loadAppAuthSession, getSessionAccessToken, type StoredAppAuthSession } from '@/services/appAuthSession';
import { fetchSignalInsights } from '@/integrations/signal-api/insights';
import { fetchSignalNotifications } from '@/integrations/signal-api/notifications';
import type { SignalApiInsight } from '@/integrations/signal-api/types';
import { formatRelativeTime } from '@/utils/date';

type AlertsFilter = 'all' | 'high' | 'signal' | 'notice' | 'account';

function alertMatchesFilter(item: StoredNotification, filter: AlertsFilter): boolean {
  if (filter === 'all') return true;
  const haystack = `${item.id} ${item.title} ${item.body}`.toLowerCase();
  if (filter === 'high') return item.high;
  if (filter === 'signal') return haystack.includes('signal') || haystack.includes('시그널') || haystack.includes('insight');
  if (filter === 'notice') return haystack.includes('notice') || haystack.includes('공지') || haystack.includes('update');
  return haystack.includes('account') || haystack.includes('계정') || haystack.includes('login') || haystack.includes('로그인');
}

export default function AlertsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [items, setItems] = useState<StoredNotification[]>([]);
  const [candidates, setCandidates] = useState<SignalApiInsight[]>([]);
  const [authSession, setAuthSession] = useState<StoredAppAuthSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<AlertsFilter>('all');
  useResetRefreshingOnTabBlur(setRefreshing);

  const reload = useCallback(async () => {
    const savedSession = await loadAppAuthSession();
    setAuthSession(savedSession);
    setAuthChecked(true);
    const access = getSessionAccessToken(savedSession);
    if (!access) {
      setItems([]);
      setCandidates([]);
      return;
    }
    const [list, serverNotifications, prefs, watchlist] = await Promise.all([
      loadNotificationHistory(),
      hasSignalApi() ? fetchSignalNotifications(access, 50).catch(() => []) : Promise.resolve([]),
      loadNotificationPrefs(),
      loadWatchlistSymbols().catch(() => [] as string[]),
    ]);
    const serverItems: StoredNotification[] = serverNotifications.map((item) => ({
      id: `server:${item.id}`,
      title: item.title,
      body: item.body,
      receivedAt: item.scheduledAt || item.createdAt || new Date().toISOString(),
      high: item.priority === 'high',
    }));
    const seen = new Set<string>();
    setItems(
      [...serverItems, ...list]
        .filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        })
        .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()),
    );
    if (!hasSignalApi() || !prefs.signalAlertsEnabled) {
      setCandidates([]);
      return;
    }
    const symbols = prefs.signalWatchlistOnly ? watchlist.map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
    const { items: rows } = await fetchSignalInsights({
      pushCandidate: true,
      symbols: symbols.length > 0 ? symbols : undefined,
      date: 'today',
      timeZone,
      limit: 10,
    }).catch(() => ({ items: [] as SignalApiInsight[], meta: { total: 0, limit: 10, offset: 0, hasMore: false } }));
    setCandidates(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await reload();
    } finally {
      setRefreshing(false);
    }
  }, [reload]);

  const alertFilters = useMemo(
    () =>
      [
        { key: 'all', label: t('alertsFilterAll') },
        { key: 'high', label: t('alertsFilterHigh') },
        { key: 'signal', label: t('alertsFilterSignal') },
        { key: 'notice', label: t('alertsFilterNotice') },
        { key: 'account', label: t('alertsFilterAccount') },
      ] as const,
    [t],
  );

  const openNotificationSettings = useCallback(() => {
    router.push('/settings?tab=notifications');
  }, [router]);

  const screenOptions = useMemo(
    () => ({
      title: t('screenAlerts'),
      headerRight: () => (
        <Pressable
          onPress={openNotificationSettings}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('alertsOpenSettings')}
          style={styles.headerSettingsBtn}>
          <FontAwesome name="bell" size={18} color={theme.green} />
        </Pressable>
      ),
    }),
    [openNotificationSettings, styles.headerSettingsBtn, t, theme.green],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => alertMatchesFilter(item, filter)),
    [filter, items],
  );

  const listHeader = useMemo(
    () => (
      <>
        <Text style={styles.hint} accessibilityRole="text">
          {t('alertsListHint')}
        </Text>
        <View style={styles.filterTabs} accessibilityRole="tablist">
          {alertFilters.map((item) => {
            const selected = filter === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[styles.filterTab, selected && styles.filterTabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}>
                <Text style={[styles.filterTabText, selected && styles.filterTabTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {candidates.length > 0 ? (
          <View style={styles.candidateSection}>
            <View style={styles.candidateHead}>
              <Text style={styles.candidateTitle}>{t('alertsCandidateTitle')}</Text>
              <Pressable
                onPress={() => router.push('/signal' as Href)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('alertsCandidateOpenAll')}>
                <Text style={styles.candidateLink}>{t('alertsCandidateOpenAll')}</Text>
              </Pressable>
            </View>
            <Text style={styles.candidateHint}>{t('alertsCandidateHint')}</Text>
            {candidates.slice(0, 3).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => router.push('/signal' as Href)}
                accessibilityRole="button"
                accessibilityLabel={item.pushTitle || item.title}
                style={({ pressed }) => [styles.candidateCard, pressed && styles.candidateCardPressed]}>
                <View style={styles.alertTop}>
                  <Text style={styles.alertTitle} numberOfLines={2}>
                    {item.pushTitle || item.title}
                  </Text>
                  {item.pushPriority === 'high' || item.level === 'alert' ? (
                    <View style={styles.high}>
                      <Text style={styles.highText}>{t('alertsHighBadge')}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.alertBody} numberOfLines={3}>
                  {item.pushBody || item.summary}
                </Text>
                <View style={styles.candidateMetaRow}>
                  <Text style={styles.candidateMeta} numberOfLines={1}>
                    {(item.symbols || []).slice(0, 4).join(', ') || t('insightSectionKicker')}
                  </Text>
                  <Text style={styles.candidateMeta}>{formatRelativeTime(item.generatedAt || '', locale)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : null}
      </>
    ),
    [alertFilters, candidates, filter, locale, router, styles, t],
  );

  const renderAlert = useCallback(
    ({ item: a }: { item: StoredNotification }) => (
      <View style={styles.alertCard}>
        <View style={styles.alertTop}>
          <Text style={styles.alertTitle}>{a.title}</Text>
          {a.high ? (
            <View style={styles.high}>
              <Text style={styles.highText}>{t('alertsHighBadge')}</Text>
            </View>
          ) : (
            <Text style={styles.time}>{formatRelativeTime(a.receivedAt, locale)}</Text>
          )}
        </View>
        <Text style={styles.alertBody}>{a.body}</Text>
        {a.high ? <Text style={styles.timeRight}>{formatRelativeTime(a.receivedAt, locale)}</Text> : null}
      </View>
    ),
    [locale, styles, t],
  );

  const bottomPad = 28 + insets.bottom;

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={screenOptions} />
        <View style={styles.loadingCenter} accessibilityRole="progressbar" accessibilityLabel={t('commonLoadingA11y')}>
          <ActivityIndicator color={theme.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (authChecked && !getSessionAccessToken(authSession)) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Stack.Screen options={screenOptions} />
        {isFocused ? <OtaUpdateBanner /> : null}
        <View style={[styles.authGate, { paddingBottom: bottomPad }]}>
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
      <Stack.Screen options={screenOptions} />
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={filteredItems}
        keyExtractor={(a) => a.id}
        renderItem={renderAlert}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          candidates.length > 0 || filteredItems.length > 0 ? null : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{items.length > 0 ? t('alertsFilterEmpty') : t('alertsEmpty')}</Text>
            </View>
          )
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad },
          filteredItems.length === 0 && candidates.length === 0 ? styles.listContentEmpty : null,
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
    safe: { flex: 1, backgroundColor: theme.bg },
    list: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    listContentEmpty: { flexGrow: 1 },
    headerSettingsBtn: {
      marginRight: 4,
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: { fontSize: sf(11), color: theme.textDim, marginBottom: 12 },
    filterTabs: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
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
      marginBottom: 10,
    },
    alertTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    alertTitle: { fontSize: sf(13), fontWeight: '700', color: theme.text, flex: 1, paddingRight: 8 },
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
