import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { ScheduleCarousel } from '@/components/signal/ScheduleCarousel';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  type HomeDigestCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api/calendar';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiMarketBriefing,
  SignalApiNewsDigestItem,
} from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import type { CalendarEvent } from '@/types/signal';
import { useRollingLocalYmd } from '@/hooks/useRollingLocalYmd';
import { addDays, formatLocalYmdLabel, parseLocalYmd, toYmd, utcRangeForLocalYmd } from '@/utils/date';

const ISSUE_LIMIT = 1;
const BRIEFING_LIMIT = 30;
const SCHEDULE_LOOKAHEAD_DAYS = 14;
const SCHEDULE_LIMIT = 6;
const DISCLOSURE_DIGEST_LIMIT = 5;

type DigestState = Record<HomeDigestCategory, SignalApiNewsDigestItem[]>;

function emptyDigestState(): DigestState {
  return { global: [], korea: [], crypto: [] };
}

function shiftYmd(ymd: string, days: number): string {
  return toYmd(addDays(parseLocalYmd(ymd), days));
}

function sortCalendarEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return [...rows].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

function filterBriefingCalendarEvents(rows: CalendarEvent[], watchlist: string[]): CalendarEvent[] {
  const watch = new Set(watchlist.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  return sortCalendarEvents(
    rows.filter((row) => {
      if (row.type === 'fed' || row.type === 'fomc' || row.type === 'holiday') return true;
      if (row.type !== 'earnings') return false;
      const symbol = String(row.symbol || '').trim().toUpperCase();
      return !!symbol && watch.has(symbol);
    }),
  ).slice(0, SCHEDULE_LIMIT);
}

function briefingLeadText(briefing: SignalApiMarketBriefing): string {
  const summary = String(briefing.summary || briefing.headline || '').trim();
  if (summary) return summary;
  return briefing.overview[0] || '';
}

function briefingSortTime(briefing: SignalApiMarketBriefing): string {
  return String(briefing.publishedAt || briefing.updatedAt || briefing.createdAt || briefing.briefingDate || '');
}

async function fetchLatestIssue(category: HomeDigestCategory, date: string): Promise<SignalApiNewsDigestItem[]> {
  const range = utcRangeForLocalYmd(date);
  const page = await fetchSignalNewsDigests({ category, ...range, limit: 80, batches: 20 }).catch(
    () => ({ items: [] as SignalApiNewsDigestItem[] }),
  );
  const item = [...page.items].sort(
    (a, b) =>
      String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
      (b.count - a.count),
  )[0];
  return item ? [item].slice(0, ISSUE_LIMIT) : [];
}

export default function TodayBriefingScreen() {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const todayYmd = useRollingLocalYmd();
  const todayLabel = useMemo(
    () =>
      formatLocalYmdLabel(todayYmd, locale, {
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
    [locale, todayYmd],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digests, setDigests] = useState<DigestState>(emptyDigestState);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [scheduleItems, setScheduleItems] = useState<CalendarEvent[]>([]);
  const [disclosureDigests, setDisclosureDigests] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [expandedSignalKey, setExpandedSignalKey] = useState<SignalSessionKey | null>(null);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setDigests(emptyDigestState());
      setBriefings([]);
      setScheduleItems([]);
      setDisclosureDigests([]);
      setError(t('errorSignalApiShort'));
      return;
    }
    setError(null);
    try {
      const watchlist = await loadWatchlistSymbols();
      const [digestResults, briefingRows, calendarRows, disclosurePage] = await Promise.all([
        Promise.all(
          HOME_DIGEST_CATEGORIES.map(async (category) => {
            const items = await fetchLatestIssue(category, todayYmd);
            return [category, items] as const;
          }),
        ),
        fetchSignalMarketBriefings({ ...utcRangeForLocalYmd(todayYmd), limit: BRIEFING_LIMIT }).catch(() => []),
        fetchSignalCalendar({
          from: todayYmd,
          to: shiftYmd(todayYmd, SCHEDULE_LOOKAHEAD_DAYS),
          limit: 120,
        }).catch(() => []),
        fetchSignalDisclosureDigests({
          ...utcRangeForLocalYmd(todayYmd),
          limit: DISCLOSURE_DIGEST_LIMIT,
          batches: 1,
        }).catch(() => ({ items: [] })),
      ]);

      const nextDigests = emptyDigestState();
      for (const [category, items] of digestResults) {
        nextDigests[category] = items;
      }
      setDigests(nextDigests);
      setBriefings(briefingRows);
      setScheduleItems(
        filterBriefingCalendarEvents(
          calendarRows
            .map((row) => signalCalendarToCalendarEvent(row))
            .filter((row): row is CalendarEvent => row != null),
          watchlist,
        ),
      );
      setDisclosureDigests(disclosurePage.items.slice(0, DISCLOSURE_DIGEST_LIMIT));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [t, todayYmd]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        try {
          await load();
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [load]),
  );

  const latestIssues = useMemo(
    () =>
      HOME_DIGEST_CATEGORIES.flatMap((category) =>
        digests[category].map((item) => ({ category, item })),
      ),
    [digests],
  );

  const briefingBySession = useMemo(() => {
    const sorted = [...briefings].sort((a, b) => briefingSortTime(b).localeCompare(briefingSortTime(a)));
    const map = new Map<SignalSessionKey, SignalApiMarketBriefing>();
    for (const tab of HOME_SIGNAL_SESSIONS) {
      const match = sorted.find((row) => row.market === tab.market && row.session === tab.session);
      if (match) map.set(tab.key, match);
    }
    return map;
  }, [briefings]);

  const openIssue = useCallback(
    (category: HomeDigestCategory, digestId?: string) => {
      router.navigate({
        pathname: '/news-issues',
        params: { category, date: todayYmd, digestId },
      } as never);
    },
    [router, todayYmd],
  );

  const openSignal = useCallback(() => {
    router.navigate('/(tabs)/signal' as never);
  }, [router]);

  const openCalendar = useCallback(() => {
    router.navigate('/calendar' as never);
  }, [router]);

  const openDisclosures = useCallback(() => {
    router.navigate('/(tabs)/disclosures' as never);
  }, [router]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('ipadHomeTitle') }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <View style={styles.datePill}>
          <FontAwesome name="calendar-o" size={13} color={theme.green} />
          <Text style={styles.dateText}>{todayLabel}</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('ipadHomeIssuesTitle')}</Text>
                <Pressable
                  onPress={() => openIssue('global')}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>{t('commonViewAll')}</Text>
                </Pressable>
              </View>
              {latestIssues.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
                </View>
              ) : (
                <View style={styles.listCard}>
                  {latestIssues.map(({ category, item }, index) => (
                    <Pressable
                      key={`${category}-${item.id}`}
                      onPress={() => openIssue(category, item.id)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.issueRow,
                        index < latestIssues.length - 1 && styles.rowBorder,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.rowTop}>
                        <Text style={styles.categoryLabel}>{t(NEWS_SEGMENT_LABEL[category])}</Text>
                        {item.aiGenerated ? (
                          <View style={styles.aiBadge}>
                            <Text style={styles.aiBadgeText}>AI</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.rowBody}>
                        <View style={styles.rowTextCol}>
                          <Text style={styles.issueTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.metaText} numberOfLines={1}>
                            {t('feedDigestSummary', {
                              count: String(item.count),
                              sources: String(item.sources.length),
                            })}
                          </Text>
                        </View>
                        <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('ipadHomeSignalTitle')}</Text>
                <Pressable
                  onPress={openSignal}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>{t('commonViewAll')}</Text>
                </Pressable>
              </View>
              <View style={styles.listCard}>
                {HOME_SIGNAL_SESSIONS.map((session, index) => {
                  const briefing = briefingBySession.get(session.key);
                  const text = briefing ? briefingLeadText(briefing) : t('briefingSessionEmptyTitle');
                  const expanded = expandedSignalKey === session.key;
                  return (
                    <Pressable
                      key={session.key}
                      onPress={() => setExpandedSignalKey((prev) => (prev === session.key ? null : session.key))}
                      accessibilityRole="button"
                      accessibilityState={{ expanded }}
                      style={({ pressed }) => [
                        styles.signalRow,
                        index < HOME_SIGNAL_SESSIONS.length - 1 && styles.rowBorder,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.sessionBadge}>
                        <Text style={styles.sessionBadgeText}>{t(session.labelId)}</Text>
                      </View>
                      <View style={styles.signalTextRow}>
                        <Text style={styles.signalText} numberOfLines={expanded ? undefined : 2}>
                          {text}
                        </Text>
                        <FontAwesome
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={11}
                          color={theme.textDim}
                        />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('todayBriefingDisclosureDigestTitle')}</Text>
                <Pressable
                  onPress={openDisclosures}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>{t('commonViewAll')}</Text>
                </Pressable>
              </View>
              {disclosureDigests.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>{t('todayBriefingDisclosureDigestEmpty')}</Text>
                </View>
              ) : (
                <DisclosureDigestSection items={disclosureDigests} />
              )}
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{t('screenCalendar')}</Text>
                <Pressable
                  onPress={openCalendar}
                  accessibilityRole="button"
                  hitSlop={8}
                  style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                  <Text style={styles.textButtonLabel}>{t('commonViewAll')}</Text>
                </Pressable>
              </View>
              <ScheduleCarousel
                events={scheduleItems}
                emptyText={t('ipadHomeCalendarEmpty')}
                onPress={openCalendar}
              />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scroll: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 28,
      gap: 18,
    },
    datePill: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    dateText: {
      fontSize: sf(13),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.text,
    },
    errorBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: theme.dangerDim,
      padding: 12,
    },
    errorText: {
      fontSize: sf(13),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.danger,
    },
    loadingBox: {
      minHeight: 220,
      alignItems: 'center',
      justifyContent: 'center',
    },
    section: {
      gap: 10,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    sectionTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    textButton: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    textButtonLabel: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '900',
      color: theme.green,
    },
    listCard: {
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    emptyCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
    },
    emptyText: {
      fontSize: sf(13),
      lineHeight: sf(19),
      fontWeight: '700',
      color: theme.textDim,
    },
    issueRow: {
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 8,
    },
    signalRow: {
      paddingHorizontal: 14,
      paddingVertical: 13,
      gap: 8,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    categoryLabel: {
      overflow: 'hidden',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.bgElevated,
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '900',
      color: theme.green,
    },
    aiBadge: {
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: theme.green,
    },
    aiBadgeText: {
      fontSize: sf(9),
      lineHeight: sf(12),
      fontWeight: '900',
      color: '#FFFFFF',
    },
    rowBody: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rowTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 4,
    },
    issueTitle: {
      fontSize: sf(15),
      lineHeight: sf(21),
      fontWeight: '900',
      color: theme.text,
    },
    metaText: {
      fontSize: sf(12),
      lineHeight: sf(16),
      fontWeight: '700',
      color: theme.textDim,
    },
    sessionBadge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    sessionBadgeText: {
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '900',
      color: theme.green,
    },
    signalText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(14),
      lineHeight: sf(20),
      fontWeight: '800',
      color: theme.text,
    },
    signalTextRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
