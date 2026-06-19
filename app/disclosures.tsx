import * as WebBrowser from 'expo-web-browser';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedUpdateBanner } from '@/components/signal/FeedUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalDisclosures } from '@/integrations/signal-api/disclosures';
import type { SignalApiDisclosure } from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { markDisclosureFeedSeen } from '@/services/disclosureUnreadPreference';
import { formatRelativeFromIso } from '@/utils/date';
import type { AppLocale, MessageId } from '@/locales/messages';

type FilterKey = 'all' | 'us' | 'kr' | 'watch';

const FILTERS: { key: FilterKey; label: MessageId }[] = [
  { key: 'all', label: 'disclosuresFilterAll' },
  { key: 'us', label: 'disclosuresFilterUs' },
  { key: 'kr', label: 'disclosuresFilterKr' },
  { key: 'watch', label: 'disclosuresFilterWatch' },
];

function disclosureTime(item: SignalApiDisclosure, locale: string): string {
  return item.filedAt ? formatRelativeFromIso(item.filedAt, locale as AppLocale) : '—';
}

function providerLabel(item: SignalApiDisclosure): string {
  if (item.provider === 'sec') return 'SEC';
  if (item.provider === 'dart') return 'DART';
  return String(item.provider || '—').toUpperCase();
}

export default function DisclosuresScreen() {
  const { symbol: symbolParam } = useLocalSearchParams<{ symbol?: string | string[] }>();
  const symbolFilter = useMemo(
    () => String(Array.isArray(symbolParam) ? symbolParam[0] : symbolParam || '').trim().toUpperCase(),
    [symbolParam],
  );
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [items, setItems] = useState<SignalApiDisclosure[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setItems([]);
      setError(t('errorSignalApiShort'));
      setLoading(false);
      return [];
    }
    setError(null);
    try {
      const watch = await loadWatchlistSymbols();
      setWatchlist(watch);
      const market = symbolFilter ? undefined : filter === 'us' ? 'us' : filter === 'kr' ? 'kr' : undefined;
      const symbols = symbolFilter || (filter === 'watch' ? watch.join(',') : undefined);
      const page = await fetchSignalDisclosures({
        market,
        symbols,
        limit: 60,
      });
      setItems(page.items);
      return page.items;
    } catch (e) {
      setError(formatSignalApiError(e, t, 'disclosuresLoadError'));
      return [];
    } finally {
      setLoading(false);
    }
  }, [filter, symbolFilter, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (!symbolFilter && items[0]?.id) {
        void markDisclosureFeedSeen(items[0].id);
      }
    }, [items, symbolFilter]),
  );

  const onRefresh = useCallback(async () => {
    const prevIds = new Set(items.map((item) => item.id));
    setRefreshing(true);
    setRefreshNotice(null);
    try {
      const latest = await load();
      const latestIds = latest.map((item) => item.id);
      const newCount = latestIds.filter((id) => !prevIds.has(id)).length;
      if (newCount > 0) {
        setRefreshNotice(t('disclosuresRefreshNotice', { count: String(newCount) }));
      }
    } finally {
      setRefreshing(false);
    }
  }, [items, load, t]);

  const emptyText =
    filter === 'watch' && watchlist.length === 0 ? t('symbolDetailNoDisclosures') : t('disclosuresEmpty');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: t('screenDisclosures'), headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <FontAwesome name="chevron-left" size={17} color={theme.text} />
          <Text style={styles.backText}>{t('commonBack')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('screenDisclosures')}</Text>
        <View style={styles.headerSpacer} />
      </View>
      {symbolFilter ? (
        <View style={styles.symbolFilterBar}>
          <Text style={styles.symbolFilterText}>{symbolFilter}</Text>
        </View>
      ) : (
        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.filterChip, selected && styles.filterChipActive]}>
                <Text style={[styles.filterText, selected && styles.filterTextActive]}>{t(f.label)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {refreshNotice ? (
        <View style={styles.noticeWrap}>
          <FeedUpdateBanner variant="notice" message={refreshNotice} />
        </View>
      ) : null}
      {loading ? (
        <View style={styles.loadingWrap}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 + insets.bottom }}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
          ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => router.push(`/disclosures/${encodeURIComponent(item.id)}` as Href)}>
              <View style={styles.cardTop}>
                <View style={styles.badges}>
                  <Text style={styles.badge}>{providerLabel(item)}</Text>
                  {item.formType ? <Text style={styles.badgeMuted}>{item.formType}</Text> : null}
                </View>
                <Text style={styles.time}>{disclosureTime(item, locale)}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.summary ? <Text style={styles.summary} numberOfLines={3}>{item.summary}</Text> : null}
              <View style={styles.cardBottom}>
                <Text style={styles.symbol}>{item.symbol || item.companyName || '—'}</Text>
                {item.url ? (
                  <Pressable
                    onPress={() => void WebBrowser.openBrowserAsync(item.url!)}
                    hitSlop={10}
                    style={styles.openBtn}>
                    <Text style={styles.openText}>{t('disclosuresOriginalOpen')}</Text>
                    <FontAwesome name="external-link" size={12} color={theme.green} />
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    header: {
      minHeight: 58,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
    },
    backText: { color: theme.text, fontSize: sf(14), fontWeight: '800' },
    title: { color: theme.text, fontSize: sf(18), fontWeight: '900' },
    headerSpacer: { width: 72 },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    filterChip: {
      flex: 1,
      minHeight: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingHorizontal: 8,
    },
    filterChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.green,
    },
    filterText: { color: theme.textMuted, fontSize: sf(12), fontWeight: '900' },
    filterTextActive: { color: '#fff' },
    symbolFilterBar: {
      marginHorizontal: 16,
      marginTop: 12,
      marginBottom: 8,
      minHeight: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    symbolFilterText: { color: theme.green, fontSize: sf(13), fontWeight: '900' },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    noticeWrap: { paddingHorizontal: 16 },
    error: {
      marginBottom: 12,
      padding: 12,
      borderRadius: 12,
      color: theme.danger,
      backgroundColor: theme.dangerDim,
      fontSize: sf(13),
      fontWeight: '800',
    },
    empty: {
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      color: theme.textMuted,
      backgroundColor: theme.card,
      fontSize: sf(14),
      fontWeight: '800',
      textAlign: 'center',
    },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 14,
      marginBottom: 10,
    },
    cardPressed: { backgroundColor: theme.bgElevated, borderColor: theme.greenBorder },
    cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 },
    badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
    badge: {
      color: theme.green,
      backgroundColor: theme.greenDim,
      borderColor: theme.greenBorder,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      fontSize: sf(10),
      fontWeight: '900',
      overflow: 'hidden',
    },
    badgeMuted: {
      color: theme.textMuted,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 7,
      fontSize: sf(10),
      fontWeight: '900',
      overflow: 'hidden',
    },
    time: { color: theme.textDim, fontSize: sf(11), fontWeight: '700' },
    cardTitle: { color: theme.text, fontSize: sf(15), lineHeight: sf(21), fontWeight: '900' },
    summary: { marginTop: 7, color: theme.textMuted, fontSize: sf(13), lineHeight: sf(19), fontWeight: '700' },
    cardBottom: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    symbol: { flex: 1, minWidth: 0, color: theme.textMuted, fontSize: sf(12), fontWeight: '900' },
    openBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    openText: { color: theme.green, fontSize: sf(12), fontWeight: '900' },
  });
}
