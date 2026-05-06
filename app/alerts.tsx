import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { loadNotificationHistory, type StoredNotification } from '@/services/notificationHistory';
import { loadNotificationPrefs } from '@/services/notificationPreferences';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { hasSignalApi } from '@/services/env';
import { fetchSignalInsights } from '@/integrations/signal-api/insights';
import type { SignalApiInsight } from '@/integrations/signal-api/types';
import { formatRelativeTime } from '@/utils/date';

export default function AlertsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const router = useRouter();
  const [items, setItems] = useState<StoredNotification[]>([]);
  const [candidates, setCandidates] = useState<SignalApiInsight[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);

  const reload = useCallback(async () => {
    const [list, prefs, watchlist] = await Promise.all([
      loadNotificationHistory(),
      loadNotificationPrefs(),
      loadWatchlistSymbols().catch(() => [] as string[]),
    ]);
    setItems(list);
    if (!hasSignalApi() || !prefs.pushEnabled || !prefs.signalAlertsEnabled) {
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
    const filtered = prefs.earningsOnly
      ? rows.filter((row) => row.topics?.includes('earnings') || row.signalDrivers?.includes('earnings_near'))
      : rows;
    setCandidates(filtered);
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

  const listHeader = useMemo(
    () => (
      <>
        <Text style={styles.hint} accessibilityRole="text">
          {t('alertsListHint')}
        </Text>
        {candidates.length > 0 ? (
          <View style={styles.candidateSection}>
            <View style={styles.candidateHead}>
              <Text style={styles.candidateTitle}>{t('alertsCandidateTitle')}</Text>
              <Pressable
                onPress={() => router.push('/insights')}
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
                onPress={() => router.push('/insights')}
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
    [candidates, locale, router, styles, t],
  );

  const listFooter = useMemo(
    () =>
      items.length > 0 ? (
        <Pressable
          onPress={() => router.push('/settings?tab=notifications')}
          style={styles.footerLink}
          accessibilityRole="button"
          accessibilityLabel={t('alertsOpenSettings')}>
          <Text style={styles.footerLinkText}>{t('alertsOpenSettings')}</Text>
        </Pressable>
      ) : null,
    [items.length, router, styles.footerLink, styles.footerLinkText, t],
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

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={renderAlert}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          candidates.length > 0 ? null : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>{t('alertsEmpty')}</Text>
              <Pressable
                onPress={() => router.push('/settings?tab=notifications')}
                style={styles.settingsLink}
                accessibilityRole="button"
                accessibilityLabel={t('alertsOpenSettings')}>
                <Text style={styles.settingsLinkText}>{t('alertsOpenSettings')}</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={listFooter}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad },
          items.length === 0 && candidates.length === 0 ? styles.listContentEmpty : null,
        ]}
        style={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
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
    hint: { fontSize: sf(11), color: theme.textDim, marginBottom: 12 },
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
    emptyText: { fontSize: sf(13), color: theme.textMuted, lineHeight: sf(20), marginBottom: 14 },
    settingsLink: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    settingsLinkText: { fontSize: sf(13), fontWeight: '800', color: theme.green },
    footerLink: {
      marginTop: 8,
      paddingVertical: 12,
      alignItems: 'center',
    },
    footerLinkText: { fontSize: sf(13), fontWeight: '700', color: theme.green },
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
  });
}
