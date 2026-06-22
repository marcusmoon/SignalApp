import { useFocusEffect } from 'expo-router/react-navigation';
import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
import { APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { fetchSignalDisclosureDigests } from '@/integrations/signal-api/disclosureDigests';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { fetchSignalNewsDigests } from '@/integrations/signal-api/newsDigests';
import type {
  SignalApiDisclosureDigestItem,
  SignalApiMarketBriefing,
  SignalApiNewsDigestItem,
} from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import type { CalendarEvent } from '@/types/signal';
import { toYmd, utcRangeForLocalYmd } from '@/utils/date';

const HOME_DIGEST_LIMIT = 3;
const HOME_CALENDAR_LIMIT = 6;
const HOME_CALENDAR_LOOKAHEAD_DAYS = 14;
const HOME_DISCLOSURE_DIGEST_LIMIT = 5;

type DigestState = Record<HomeDigestCategory, SignalApiNewsDigestItem[]>;

function emptyDigestState(): DigestState {
  return { global: [], korea: [], crypto: [] };
}

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m - 1, d);
}

function shiftYmd(ymd: string, days: number): string {
  const d = parseYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function localeForDate(locale: 'ko' | 'en' | 'ja'): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function formatTodayHeading(value: string, locale: 'ko' | 'en' | 'ja'): string {
  try {
    return new Intl.DateTimeFormat(localeForDate(locale), {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(parseYmd(value));
  } catch {
    return value;
  }
}

function sortDigestItems(items: SignalApiNewsDigestItem[]): SignalApiNewsDigestItem[] {
  return [...items]
    .sort(
      (a, b) =>
        String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')) ||
        (b.count - a.count),
    )
    .slice(0, HOME_DIGEST_LIMIT);
}

async function fetchTopDigestsForCategory(category: HomeDigestCategory, date: string): Promise<SignalApiNewsDigestItem[]> {
  const range = utcRangeForLocalYmd(date);
  const page = await fetchSignalNewsDigests({ category, ...range, limit: 80, batches: 20 }).catch(
    () => ({ items: [] as SignalApiNewsDigestItem[] }),
  );
  return sortDigestItems(page.items);
}

function categoryTone(category: HomeDigestCategory, theme: AppTheme) {
  if (category === 'crypto') {
    return {
      bg: theme.warningDim,
      border: theme.border,
      text: theme.warning,
    };
  }
  if (category === 'korea') {
    return {
      bg: theme.bgElevated,
      border: theme.border,
      text: theme.text,
    };
  }
  return {
    bg: theme.greenDim,
    border: theme.greenBorder,
    text: theme.green,
  };
}

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      String(a.date || '').localeCompare(String(b.date || '')) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

function filterHomeCalendarEvents(rows: CalendarEvent[], watchlist: string[]): CalendarEvent[] {
  const watch = new Set(watchlist.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  return sortDayEvents(
    rows.filter((row) => {
      if (row.type === 'fed' || row.type === 'fomc' || row.type === 'holiday') return true;
      if (row.type !== 'earnings') return false;
      const symbol = String(row.symbol || '').trim().toUpperCase();
      return !!symbol && watch.has(symbol);
    }),
  ).slice(0, HOME_CALENDAR_LIMIT);
}

function briefingLeadText(briefing: SignalApiMarketBriefing): string {
  const summary = String(briefing.summary || briefing.headline || '').trim();
  if (summary) return summary;
  return briefing.overview[0] || '';
}

type IpadHomeScreenProps = {
  showHeading?: boolean;
};

export function IpadHomeScreen({ showHeading = true }: IpadHomeScreenProps) {
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const todayLabel = useMemo(() => formatTodayHeading(todayYmd, locale), [locale, todayYmd]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digests, setDigests] = useState<DigestState>(emptyDigestState);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [disclosureDigests, setDisclosureDigests] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [expandedDigestId, setExpandedDigestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setDigests(emptyDigestState());
      setBriefings([]);
      setCalendarEvents([]);
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
            const items = await fetchTopDigestsForCategory(category, todayYmd);
            return [category, items] as const;
          }),
        ),
        fetchSignalMarketBriefings({ ...utcRangeForLocalYmd(todayYmd), limit: 30 }).catch(() => []),
        fetchSignalCalendar({
          from: todayYmd,
          to: shiftYmd(todayYmd, HOME_CALENDAR_LOOKAHEAD_DAYS),
          limit: 120,
        }).catch(() => []),
        fetchSignalDisclosureDigests({
          ...utcRangeForLocalYmd(todayYmd),
          limit: HOME_DISCLOSURE_DIGEST_LIMIT,
          batches: 1,
        }).catch(() => ({ items: [] })),
      ]);

      const nextDigests = emptyDigestState();
      for (const [category, items] of digestResults) {
        nextDigests[category] = items;
      }
      setDigests(nextDigests);
      setBriefings(briefingRows);
      setCalendarEvents(
        filterHomeCalendarEvents(
          calendarRows
            .map((row) => signalCalendarToCalendarEvent(row))
            .filter((row): row is CalendarEvent => row != null),
          watchlist,
        ),
      );
      setDisclosureDigests(disclosurePage.items.slice(0, HOME_DISCLOSURE_DIGEST_LIMIT));
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

  const briefingBySession = useMemo(() => {
    const map = new Map<SignalSessionKey, SignalApiMarketBriefing>();
    for (const tab of HOME_SIGNAL_SESSIONS) {
      const match = briefings.find((row) => row.market === tab.market && row.session === tab.session);
      if (match) map.set(tab.key, match);
    }
    return map;
  }, [briefings]);

  const visibleCalendarEvents = calendarEvents.slice(0, HOME_CALENDAR_LIMIT);
  const hiddenCalendarCount = Math.max(0, calendarEvents.length - visibleCalendarEvents.length);
  const issueRows = useMemo(
    () =>
      HOME_DIGEST_CATEGORIES.flatMap((category) =>
        digests[category].map((item) => ({ category, item })),
      ).sort(
        (a, b) =>
          (b.item.count - a.item.count) ||
          String(b.item.generatedAt || '').localeCompare(String(a.item.generatedAt || '')),
      ),
    [digests],
  );

  const goIssues = useCallback(
    (category: HomeDigestCategory, digestId?: string) => {
      if (ipadNav.isAvailable) {
        ipadNav.showNewsIssues({ category, date: todayYmd, digestId });
        return;
      }
      router.navigate({
        pathname: '/news-issues',
        params: { category, date: todayYmd, digestId },
      } as never);
    },
    [ipadNav, router, todayYmd],
  );

  const goSignal = useCallback(
    (session: SignalSessionKey) => {
      ipadNav.showSignalTab(session);
      router.navigate('/(tabs)/signal' as never);
    },
    [ipadNav, router],
  );

  const goCalendar = useCallback(() => {
    ipadNav.showTabs();
    router.navigate('/calendar' as never);
  }, [ipadNav, router]);

  const goDisclosures = useCallback(() => {
    ipadNav.showTabs();
    router.navigate('/(tabs)/disclosures' as never);
  }, [ipadNav, router]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <View style={styles.inner}>
        <View style={styles.heroPanel}>
          {showHeading ? (
            <View style={styles.heroTop}>
              <View style={styles.heroTitleCol}>
                <Text style={styles.pageTitle}>{t('ipadHomeTitle')}</Text>
                <Text style={styles.pageDate}>{todayLabel}</Text>
              </View>
            </View>
          ) : null}
        </View>

        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loadingBox}>
            <SignalLoadingIndicator message={t('commonLoading')} />
          </View>
        ) : (
          <>
            <View style={styles.issueBoard}>
              <View style={styles.boardHeader}>
                <View>
                  <Text style={styles.boardTitle}>{t('ipadHomeIssuesTitle')}</Text>
                  <Text style={styles.boardSubtitle}>{t('ipadHomeIssuesSubtitle')}</Text>
                </View>
              </View>
              <View style={styles.issueLaneRow}>
                {HOME_DIGEST_CATEGORIES.map((category) => {
                  const items = digests[category];
                  const tone = categoryTone(category, theme);
                  return (
                    <View key={category} style={[styles.issueLane, { borderTopColor: tone.text }]}>
                      <View style={styles.laneHeader}>
                        <View>
                          <Text style={[styles.laneTitle, { color: tone.text }]}>
                            {t(NEWS_SEGMENT_LABEL[category])}
                          </Text>
                          <Text style={styles.laneMeta} numberOfLines={1}>
                            {items.length > 0
                              ? t('feedDigestSummary', {
                                  count: String(items.reduce((sum, item) => sum + item.count, 0)),
                                  sources: String(new Set(items.flatMap((item) => item.sources)).size),
                                })
                              : t('ipadHomeIssuesEmpty')}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => goIssues(category)}
                          accessibilityRole="button"
                          hitSlop={8}
                          style={({ pressed }) => [styles.laneMoreBtn, pressed && styles.pressed]}>
                          <Text style={styles.laneMoreText}>{t('commonViewAll')}</Text>
                        </Pressable>
                      </View>

                      {items.length === 0 ? (
                        <Text style={styles.emptyLine}>{t('ipadHomeIssuesEmpty')}</Text>
                      ) : (
                        items.map((item, index) => (
                          <View
                            key={item.id}
                            style={[styles.issueCard, index < items.length - 1 && styles.issueRowBorder]}>
                            <Pressable
                              onPress={() => goIssues(category, item.id)}
                              accessibilityRole="button"
                              style={({ pressed }) => [pressed && styles.pressed]}>
                              {(item.aiGenerated || item.topics.length > 0 || item.symbols.length > 0) ? (
                                <View style={styles.issueBadgeRow}>
                                  {item.aiGenerated ? (
                                    <View style={styles.aiBadge}>
                                      <Text style={styles.aiBadgeText}>AI</Text>
                                    </View>
                                  ) : null}
                                  {item.topics.slice(0, 3).map((topic) => (
                                    <Text key={topic} style={styles.topicChip} numberOfLines={1}>
                                      {topic}
                                    </Text>
                                  ))}
                                  {item.symbols.slice(0, 2).map((symbol) => (
                                    <Text key={symbol} style={[styles.topicChip, styles.symbolChip]} numberOfLines={1}>
                                      {symbol}
                                    </Text>
                                  ))}
                                </View>
                              ) : null}
                              <Text style={styles.issueTitle} numberOfLines={2}>
                                {item.title}
                              </Text>
                              <Text style={styles.issueSummary} numberOfLines={2}>
                                {item.summary}
                              </Text>
                            </Pressable>
                            <View style={styles.issueFooterRow}>
                              <Text style={styles.issueMeta} numberOfLines={1}>
                                {t('feedDigestSummary', {
                                  count: String(item.count),
                                  sources: String(item.sources.length),
                                })}
                              </Text>
                              <Pressable
                                onPress={() =>
                                  setExpandedDigestId((prev) => (prev === item.id ? null : item.id))
                                }
                                accessibilityRole="button"
                                accessibilityState={{ expanded: expandedDigestId === item.id }}
                                hitSlop={8}
                                style={({ pressed }) => [styles.sourceToggle, pressed && styles.pressed]}>
                                <Text style={styles.sourceToggleText}>
                                  {t(expandedDigestId === item.id ? 'feedDigestCollapse' : 'feedDigestExpand')}
                                </Text>
                              </Pressable>
                            </View>
                            {expandedDigestId === item.id ? (
                              <View style={styles.sourceList}>
                                {(item.sourceRefs || []).slice(0, 5).map((ref, refIndex) => (
                                  <Pressable
                                    key={`${item.id}-${refIndex}`}
                                    onPress={ref.url ? () => void Linking.openURL(ref.url!).catch(() => null) : undefined}
                                    accessibilityRole={ref.url ? 'link' : 'text'}
                                    style={({ pressed }) => [styles.sourceRow, pressed && ref.url && styles.pressed]}>
                                    <View style={styles.sourceTextCol}>
                                      <Text style={styles.sourceTitle} numberOfLines={2}>
                                        {ref.title || ref.sourceName || ref.url || ''}
                                      </Text>
                                      {ref.sourceName ? (
                                        <Text style={styles.sourceName} numberOfLines={1}>
                                          {ref.sourceName}
                                        </Text>
                                      ) : null}
                                    </View>
                                    {ref.url ? <FontAwesome name="external-link" size={10} color={theme.green} /> : null}
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </View>
                        ))
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.widePanel}>
              <View style={styles.compactHeader}>
                <Text style={styles.compactTitle}>{t('ipadHomeSignalTitle')}</Text>
                <Text style={styles.compactSubtitle}>{t('ipadHomeSignalSubtitle')}</Text>
              </View>
              <View style={styles.signalList}>
                {HOME_SIGNAL_SESSIONS.map((session, index) => {
                  const briefing = briefingBySession.get(session.key);
                  const lead = briefing ? briefingLeadText(briefing) : '';
                  return (
                    <Pressable
                      key={session.key}
                      onPress={() => goSignal(session.key)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.signalListRow,
                        index < HOME_SIGNAL_SESSIONS.length - 1 && styles.signalListRowBorder,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.signalListLabelCol}>
                        <Text style={styles.sessionLabel}>{t(session.labelId)}</Text>
                        <Text style={styles.blockHeaderHint} numberOfLines={1}>
                          {t(session.hintId)}
                        </Text>
                      </View>
                      <Text style={styles.signalListText} numberOfLines={2}>
                        {lead || t('briefingSessionEmptyTitle')}
                      </Text>
                      <FontAwesome name="chevron-right" size={12} color={theme.textDim} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.widePanel}>
              <View style={styles.compactHeader}>
                <Text style={styles.compactTitle}>{t('todayBriefingDisclosureDigestTitle')}</Text>
                <Text style={styles.compactSubtitle}>{t('todayBriefingDisclosureDigestSubtitle')}</Text>
              </View>
              {disclosureDigests.length > 0 ? (
                <DisclosureDigestSection items={disclosureDigests} />
              ) : (
                <Text style={styles.emptyLine}>{t('todayBriefingDisclosureDigestEmpty')}</Text>
              )}
              <Pressable
                onPress={goDisclosures}
                accessibilityRole="button"
                style={({ pressed }) => [styles.calendarMoreBtn, pressed && styles.pressed]}>
                <Text style={styles.calendarMoreText}>{t('commonViewAll')}</Text>
              </Pressable>
            </View>

            <View style={styles.widePanel}>
              <View style={styles.compactHeader}>
                <Text style={styles.compactTitle}>{t('ipadHomeCalendarTitle')}</Text>
                <Text style={styles.compactSubtitle}>{t('ipadHomeCalendarSubtitle')}</Text>
              </View>
              <ScheduleCarousel
                events={visibleCalendarEvents}
                emptyText={t('ipadHomeCalendarEmpty')}
                onPress={goCalendar}
              />
              {hiddenCalendarCount > 0 ? (
                <Pressable
                  onPress={goCalendar}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.calendarMoreBtn, pressed && styles.pressed]}>
                  <Text style={styles.calendarMoreText}>
                    {t('ipadHomeCalendarMore', { count: String(hiddenCalendarCount) })}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    inner: {
      width: '100%',
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      gap: 16,
    },
    pageHead: {
      alignItems: 'center',
      gap: 4,
      marginBottom: 8,
      paddingVertical: 8,
    },
    pageTitle: {
      fontSize: sf(24),
      fontWeight: '800',
      color: theme.text,
      letterSpacing: -0.4,
      textAlign: 'center',
    },
    pageDate: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.textMuted,
      textAlign: 'center',
    },
    heroPanel: {
      gap: 14,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 18,
    },
    heroTitleCol: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 4,
    },
    loadingBox: {
      paddingVertical: 48,
      alignItems: 'center',
    },
    errBox: {
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
    },
    errText: {
      fontSize: sf(12),
      color: theme.danger,
      lineHeight: sf(18),
    },
    sectionCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      overflow: 'hidden',
    },
    sectionHeaderBand: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.greenDim,
      gap: 2,
    },
    sectionTitle: {
      fontSize: sf(17),
      fontWeight: '800',
      color: theme.text,
    },
    sectionSubtitle: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
    },
    sectionBody: {
      padding: 12,
    },
    sectionStack: {
      gap: 10,
    },
    issueBoard: {
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 14,
    },
    boardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    boardTitle: {
      fontSize: sf(19),
      lineHeight: sf(25),
      fontWeight: '900',
      color: theme.text,
    },
    boardSubtitle: {
      marginTop: 2,
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.textMuted,
    },
    issueLaneRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    issueLane: {
      flex: 1,
      minWidth: 0,
      borderTopWidth: 3,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 4,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
    },
    laneHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 4,
    },
    laneTitle: {
      fontSize: sf(15),
      lineHeight: sf(20),
      fontWeight: '900',
    },
    laneMeta: {
      marginTop: 2,
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '700',
      color: theme.textMuted,
    },
    laneMoreBtn: {
      minHeight: 28,
      justifyContent: 'center',
      paddingHorizontal: 8,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
    },
    laneMoreText: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.green,
    },
    lowerGrid: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
    },
    widePanel: {
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    compactPanel: {
      flex: 1,
      minWidth: 0,
      borderRadius: 24,
      padding: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 12,
    },
    compactHeader: {
      gap: 2,
    },
    compactTitle: {
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
    },
    compactSubtitle: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.textMuted,
    },
    signalSessionGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    sessionCard: {
      width: '48%',
      minHeight: 114,
      borderRadius: 18,
      padding: 13,
      backgroundColor: theme.bg,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 8,
    },
    sessionLabel: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '900',
      color: theme.green,
    },
    sessionText: {
      fontSize: sf(13),
      lineHeight: sf(20),
      fontWeight: '700',
      color: theme.text,
    },
    signalList: {
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
    },
    signalListRow: {
      minHeight: 78,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    signalListRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    signalListLabelCol: {
      width: 150,
      flexShrink: 0,
      gap: 2,
    },
    signalListText: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(14),
      lineHeight: sf(21),
      fontWeight: '800',
      color: theme.text,
    },
    blockCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      overflow: 'hidden',
    },
    blockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.greenDim,
    },
    blockHeaderTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    blockHeaderTitle: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.text,
    },
    blockHeaderHint: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
    },
    blockHeaderAction: {
      minHeight: 28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 9,
      borderRadius: 999,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    blockHeaderActionText: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
    },
    blockBody: {
      paddingHorizontal: 12,
      paddingVertical: 4,
    },
    issueCard: {
      gap: 7,
      paddingVertical: 11,
    },
    issueRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    issueBadgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 6,
    },
    aiBadge: {
      minHeight: 20,
      paddingHorizontal: 7,
      borderRadius: 999,
      backgroundColor: theme.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    aiBadgeText: {
      color: '#FFFFFF',
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '900',
    },
    topicChip: {
      overflow: 'hidden',
      maxWidth: 150,
      minHeight: 20,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '800',
      color: theme.textMuted,
    },
    symbolChip: {
      color: theme.green,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    issueTitle: {
      fontSize: sf(14),
      fontWeight: '900',
      color: theme.text,
      lineHeight: sf(20),
    },
    issueSummary: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      lineHeight: sf(18),
    },
    issueFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
    },
    issueMeta: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(11),
      fontWeight: '700',
      color: theme.textMuted,
    },
    sourceToggle: {
      flexShrink: 0,
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 999,
      backgroundColor: theme.greenDim,
    },
    sourceToggleText: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '900',
      color: theme.green,
    },
    sourceList: {
      overflow: 'hidden',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    sourceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    sourceTextCol: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    sourceTitle: {
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '800',
      color: theme.text,
    },
    sourceName: {
      fontSize: sf(10),
      lineHeight: sf(14),
      fontWeight: '700',
      color: theme.textMuted,
    },
    signalSummary: {
      fontSize: sf(14),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(21),
      paddingVertical: 8,
    },
    signalBullets: {
      gap: 6,
      paddingBottom: 8,
    },
    signalBulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    signalBulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.green,
      marginTop: sf(7),
    },
    signalBulletText: {
      flex: 1,
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textDim,
      lineHeight: sf(18),
    },
    calendarRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: 10,
    },
    calendarRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    calendarTime: {
      width: 52,
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.textMuted,
      paddingTop: 2,
    },
    calendarBody: {
      flex: 1,
      gap: 2,
      justifyContent: 'center',
    },
    calendarTitle: {
      fontSize: sf(14),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(20),
    },
    calendarMeta: {
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textMuted,
    },
    calendarMoreBtn: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 2,
    },
    calendarMoreText: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.green,
    },
    emptyLine: {
      fontSize: sf(12),
      fontWeight: '600',
      color: theme.textMuted,
      lineHeight: sf(18),
      paddingVertical: 10,
    },
    pressed: { opacity: 0.75 },
  });
}
