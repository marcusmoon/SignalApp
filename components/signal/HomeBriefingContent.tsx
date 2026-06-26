import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { HomeAiBadge } from '@/components/signal/HomeAiBadge';
import { HomeSectionIconButton } from '@/components/signal/HomeSectionIconButton';
import { ScheduleCarousel } from '@/components/signal/ScheduleCarousel';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
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
import {
  addDays,
  calendarEventDisplayYmd,
  calendarEventInLocalYmdRange,
  formatLocalYmdLabel,
  parseLocalYmd,
  toYmd,
  utcRangeForLocalYmd,
} from '@/utils/date';

const ISSUE_LIMIT = 1;
const BRIEFING_LIMIT = 30;
const SCHEDULE_LOOKAHEAD_DAYS = 14;
const SCHEDULE_LIMIT = 6;
const DISCLOSURE_DIGEST_LIMIT = 5;

type DigestState = Record<HomeDigestCategory, SignalApiNewsDigestItem[]>;

type HomeBriefingContentProps = {
  selectedYmd: string;
  todayYmd: string;
  onSelectedYmdChange: (ymd: string) => void;
  showDateNavigator?: boolean;
  scrollContentPaddingBottom?: number;
  headerAccessory?: ReactNode;
  showRefreshFab?: boolean;
  fabBottom?: number;
};

function emptyDigestState(): DigestState {
  return { global: [], korea: [], crypto: [] };
}

function shiftYmd(ymd: string, days: number): string {
  return toYmd(addDays(parseLocalYmd(ymd), days));
}

function sortCalendarEvents(rows: CalendarEvent[]): CalendarEvent[] {
  return [...rows].sort(
    (a, b) =>
      calendarEventDisplayYmd(a).localeCompare(calendarEventDisplayYmd(b)) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

function filterBriefingCalendarEvents(
  rows: CalendarEvent[],
  watchlist: string[],
  fromYmd: string,
  toYmdValue: string,
): CalendarEvent[] {
  const watch = new Set(watchlist.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean));
  return sortCalendarEvents(
    rows.filter((row) => {
      if (!calendarEventInLocalYmdRange(row, fromYmd, toYmdValue)) return false;
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

export function HomeBriefingContent({
  selectedYmd,
  todayYmd,
  onSelectedYmdChange,
  showDateNavigator = true,
  scrollContentPaddingBottom = 28,
  headerAccessory,
  showRefreshFab = false,
  fabBottom = 88,
}: HomeBriefingContentProps) {
  const router = useRouter();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const selectedDateLabel = useMemo(
    () =>
      formatLocalYmdLabel(selectedYmd, locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'short',
      }),
    [locale, selectedYmd],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digests, setDigests] = useState<DigestState>(emptyDigestState);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [scheduleItems, setScheduleItems] = useState<CalendarEvent[]>([]);
  const [disclosureDigests, setDisclosureDigests] = useState<SignalApiDisclosureDigestItem[]>([]);
  const [expandedSignalKey, setExpandedSignalKey] = useState<SignalSessionKey | null>(null);
  const loadedYmdRef = useRef<string | null>(null);

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
            const items = await fetchLatestIssue(category, selectedYmd);
            return [category, items] as const;
          }),
        ),
        fetchSignalMarketBriefings({ ...utcRangeForLocalYmd(selectedYmd), limit: BRIEFING_LIMIT }).catch(() => []),
        fetchSignalCalendar({
          from: shiftYmd(selectedYmd, -1),
          to: shiftYmd(selectedYmd, SCHEDULE_LOOKAHEAD_DAYS),
          limit: 120,
        }).catch(() => []),
        fetchSignalDisclosureDigests({
          ...utcRangeForLocalYmd(selectedYmd),
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
          selectedYmd,
          shiftYmd(selectedYmd, SCHEDULE_LOOKAHEAD_DAYS),
        ),
      );
      setDisclosureDigests(disclosurePage.items.slice(0, DISCLOSURE_DIGEST_LIMIT));
    } catch (e) {
      setError(formatSignalApiError(e, t, 'ipadHomeLoadError'));
    }
  }, [selectedYmd, t]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const needsInitialLoad = loadedYmdRef.current !== selectedYmd;
    if (needsInitialLoad) setLoading(true);
    void (async () => {
      try {
        await load();
        if (!cancelled) loadedYmdRef.current = selectedYmd;
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, selectedYmd]);

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
        params: { category, date: selectedYmd, digestId },
      } as never);
    },
    [router, selectedYmd],
  );

  const openSignal = useCallback(() => {
    router.navigate({
      pathname: '/(tabs)/signal',
      params: { date: selectedYmd },
    } as never);
  }, [router, selectedYmd]);

  const openSignalSession = useCallback(
    (session: SignalSessionKey) => {
      router.navigate({
        pathname: '/(tabs)/signal',
        params: { session, date: selectedYmd },
      } as never);
    },
    [router, selectedYmd],
  );

  const openCalendar = useCallback(() => {
    router.navigate('/calendar' as never);
  }, [router]);

  const openDisclosures = useCallback(() => {
    router.navigate('/(tabs)/disclosures' as never);
  }, [router]);

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: scrollContentPaddingBottom }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {headerAccessory}
      {showDateNavigator ? (
        <SignalDateNavigator
          label={selectedDateLabel}
          previousA11y={t('insightDatePrevious')}
          nextA11y={t('insightDateNext')}
          labelA11y={t('insightOpenCalendar')}
          todayLabel={t('insightCalendarToday')}
          onPrevious={() => onSelectedYmdChange(shiftYmd(selectedYmd, -1))}
          onNext={() => onSelectedYmdChange(shiftYmd(selectedYmd, 1))}
          onPressLabel={openCalendar}
          onToday={() => onSelectedYmdChange(todayYmd)}
          showToday={selectedYmd !== todayYmd}
        />
      ) : null}

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
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('ipadHomeIssuesTitle')}</Text>
                <HomeAiBadge />
              </View>
              <HomeSectionIconButton
                icon="chevron-right"
                accessibilityLabel={t('commonViewAll')}
                onPress={() => openIssue('global')}
                solid={false}
              />
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
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{t('ipadHomeSignalTitle')}</Text>
                <HomeAiBadge />
              </View>
              <HomeSectionIconButton
                icon="chevron-right"
                accessibilityLabel={t('commonViewAll')}
                onPress={openSignal}
                solid={false}
              />
            </View>
            <View style={styles.listCard}>
              {HOME_SIGNAL_SESSIONS.map((session, index) => {
                const briefing = briefingBySession.get(session.key);
                const text = briefing ? briefingLeadText(briefing) : t('briefingSessionEmptyTitle');
                const expanded = expandedSignalKey === session.key;
                const canOpenFull = !!briefing;
                return (
                  <View
                    key={session.key}
                    style={[styles.signalRow, index < HOME_SIGNAL_SESSIONS.length - 1 && styles.rowBorder]}>
                    <View style={styles.signalRowHeader}>
                      <View style={styles.sessionBadge}>
                        <Text style={styles.sessionBadgeText}>{t(session.labelId)}</Text>
                      </View>
                      {canOpenFull ? (
                        <HomeSectionIconButton
                          icon="arrow-right"
                          accessibilityLabel={t('homeSignalOpenFullA11y')}
                          onPress={() => openSignalSession(session.key)}
                          solid={false}
                        />
                      ) : null}
                    </View>
                    {canOpenFull ? (
                      <Pressable
                        onPress={() => setExpandedSignalKey((prev) => (prev === session.key ? null : session.key))}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        style={({ pressed }) => [styles.signalTextRow, pressed && styles.pressed]}>
                        <Text style={styles.signalText} numberOfLines={expanded ? undefined : 2}>
                          {text}
                        </Text>
                        <FontAwesome
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={11}
                          color={theme.textDim}
                        />
                      </Pressable>
                    ) : (
                      <Text style={styles.signalText} numberOfLines={2}>
                        {text}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t('todayBriefingDisclosureDigestTitle')}</Text>
              <HomeSectionIconButton
                icon="chevron-right"
                accessibilityLabel={t('commonViewAll')}
                onPress={openDisclosures}
                solid={false}
              />
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
              <HomeSectionIconButton
                icon="chevron-right"
                accessibilityLabel={t('commonViewAll')}
                onPress={openCalendar}
                solid={false}
              />
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
      {showRefreshFab && hasSignalApi() ? (
        <FloatingGlassFab
          bottom={fabBottom}
          onPress={() => void refresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing || loading}
        />
      ) : null}
    </>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 18,
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
    sectionTitleRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      flexShrink: 1,
      fontSize: sf(18),
      lineHeight: sf(24),
      fontWeight: '900',
      color: theme.text,
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
    signalRowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
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
