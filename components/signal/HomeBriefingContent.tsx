import { useRouter } from 'expo-router';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { webScrollViewportStyle } from '@/constants/webLayout';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';

import { DisclosureDigestSection } from '@/components/disclosures/DisclosureDigestSection';
import { HomeAiBadge } from '@/components/signal/HomeAiBadge';
import { HomeSectionAccentLine } from '@/components/signal/HomeSectionAccentLine';
import { HomeSectionDivider } from '@/components/signal/HomeSectionDivider';
import { HomeSectionHeader } from '@/components/signal/HomeSectionHeader';
import { ScheduleCarousel } from '@/components/signal/ScheduleCarousel';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import {
  HOME_DIGEST_CATEGORIES,
  HOME_SIGNAL_SESSIONS,
  homeDigestCategoryIcon,
  type HomeDigestCategory,
  type SignalSessionKey,
} from '@/constants/ipadHomeNav';
import type { AppTheme } from '@/constants/theme';
import { NEWS_SEGMENT_LABEL } from '@/domain/news/feedFilters';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
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
}: HomeBriefingContentProps) {
  const router = useRouter();
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);

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
  const selectedIsToday = selectedYmd >= todayYmd;

  const changeSelectedYmd = useCallback(
    (ymd: string) => {
      onSelectedYmdChange(ymd > todayYmd ? todayYmd : ymd);
    },
    [onSelectedYmdChange, todayYmd],
  );

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [digests, setDigests] = useState<DigestState>(emptyDigestState);
  const [briefings, setBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [scheduleItems, setScheduleItems] = useState<CalendarEvent[]>([]);
  const [disclosureDigests, setDisclosureDigests] = useState<SignalApiDisclosureDigestItem[]>([]);
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

  useEffect(() => {
    if (selectedYmd > todayYmd) {
      changeSelectedYmd(todayYmd);
    }
  }, [changeSelectedYmd, selectedYmd, todayYmd]);

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
    <WebWheelScrollView
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
          onPrevious={() => changeSelectedYmd(shiftYmd(selectedYmd, -1))}
          onNext={() => changeSelectedYmd(shiftYmd(selectedYmd, 1))}
          onPressLabel={openCalendar}
          onToday={() => changeSelectedYmd(todayYmd)}
          showToday={!selectedIsToday}
          nextDisabled={selectedIsToday}
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
            <HomeSectionHeader
              title={t('ipadHomeIssuesTitle')}
              badge={<HomeAiBadge />}
              onPress={() => openIssue('global')}
              accessibilityLabel={t('commonViewAll')}
            />
            {latestIssues.length === 0 ? (
              <View style={styles.emptyCard}>
                <HomeSectionAccentLine section="issues" />
                <Text style={styles.emptyText}>{t('ipadHomeIssuesEmpty')}</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                <HomeSectionAccentLine section="issues" />
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
                    <View style={styles.categoryBadge}>
                      <FontAwesome name={homeDigestCategoryIcon(category)} size={11} color={theme.textMuted} />
                      <Text style={styles.categoryBadgeText}>{t(NEWS_SEGMENT_LABEL[category])}</Text>
                    </View>
                    <Text style={styles.issueTitle} numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text style={styles.metaText} numberOfLines={1}>
                      {t('feedDigestSummary', {
                        count: String(item.count),
                        sources: String(item.sources.length),
                      })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <HomeSectionDivider />

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('ipadHomeSignalTitle')}
              badge={<HomeAiBadge />}
              onPress={openSignal}
              accessibilityLabel={t('commonViewAll')}
            />
            <View style={styles.listCard}>
              <HomeSectionAccentLine section="signal" />
              {HOME_SIGNAL_SESSIONS.map((session, index) => {
                const briefing = briefingBySession.get(session.key);
                const text = briefing ? briefingLeadText(briefing) : t('briefingSessionEmptyTitle');
                const canOpenFull = !!briefing;
                return (
                  <Pressable
                    key={session.key}
                    onPress={canOpenFull ? () => openSignalSession(session.key) : undefined}
                    disabled={!canOpenFull}
                    accessibilityRole={canOpenFull ? 'button' : undefined}
                    accessibilityLabel={canOpenFull ? t('homeSignalOpenFullA11y') : undefined}
                    style={({ pressed }) => [
                      styles.signalRow,
                      index < HOME_SIGNAL_SESSIONS.length - 1 && styles.rowBorder,
                      canOpenFull && pressed && styles.pressed,
                    ]}>
                    <View style={styles.sessionBadge}>
                      <Text style={styles.sessionBadgeText}>{t(session.labelId)}</Text>
                    </View>
                    <Text style={[styles.signalText, !canOpenFull && styles.signalTextEmpty]} numberOfLines={3}>
                      {text}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <HomeSectionDivider />

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('todayBriefingDisclosureDigestTitle')}
              onPress={openDisclosures}
              accessibilityLabel={t('commonViewAll')}
            />
            {disclosureDigests.length === 0 ? (
              <View style={styles.emptyCard}>
                <HomeSectionAccentLine section="disclosure" />
                <Text style={styles.emptyText}>{t('todayBriefingDisclosureDigestEmpty')}</Text>
              </View>
            ) : (
              <DisclosureDigestSection items={disclosureDigests} accentSection="disclosure" />
            )}
          </View>

          <HomeSectionDivider />

          <View style={styles.section}>
            <HomeSectionHeader
              title={t('screenCalendar')}
              onPress={openCalendar}
              accessibilityLabel={t('commonViewAll')}
            />
            <ScheduleCarousel
              events={scheduleItems}
              emptyText={t('ipadHomeCalendarEmpty')}
              onPress={openCalendar}
            />
          </View>
        </>
      )}
    </WebWheelScrollView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  return StyleSheet.create({
    scroll: {
      ...webScrollViewportStyle,
      backgroundColor: theme.bg,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 14,
      gap: 24,
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
      gap: 12,
    },
    listCard: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    emptyCard: {
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      padding: 16,
      paddingLeft: 18,
    },
    emptyText: {
      fontSize: ft.ff(13),
      lineHeight: sf(19),
      fontWeight: ft.bodyWeight,
      color: theme.textDim,
    },
    issueRow: {
      paddingHorizontal: 14,
      paddingLeft: 16,
      paddingVertical: ft.row(13),
      gap: 8,
    },
    signalRow: {
      paddingHorizontal: 14,
      paddingLeft: 16,
      paddingVertical: ft.signalRow(13),
      gap: 8,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    issueTitle: {
      fontSize: ft.ff(15),
      lineHeight: sf(21),
      fontWeight: ft.titleWeight,
      color: theme.text,
    },
    metaText: {
      fontSize: ft.ff(12),
      lineHeight: sf(16),
      fontWeight: ft.metaWeight,
      color: theme.textDim,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryBadgeText: {
      fontSize: ft.ff(11),
      lineHeight: sf(14),
      fontWeight: ft.emphasisWeight,
      color: theme.textMuted,
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
      fontSize: ft.ff(11),
      lineHeight: sf(14),
      fontWeight: ft.emphasisWeight,
      color: theme.green,
    },
    signalText: {
      fontSize: ft.signalBodyFont(14),
      lineHeight: sf(20),
      fontWeight: ft.signalBodyWeight,
      color: theme.textMuted,
    },
    signalTextEmpty: {
      color: theme.textDim,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
