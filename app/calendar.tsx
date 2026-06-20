import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from "expo-router/react-navigation";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  fetchSignalCalendar,
  signalCalendarToCalendarEvent,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { hasSignalApi } from '@/services/env';
import {
  CALENDAR_EVENT_TYPE_ORDER,
  loadCalendarEventTypeFilter,
  saveCalendarEventTypeFilter,
  type CalendarEventTypeKey,
} from '@/services/calendarEventTypeFilterPreference';
import { toYmd } from '@/utils/date';
import type { MessageId } from '@/locales/messages';
import type { CalendarEvent } from '@/types/signal';

const CALENDAR_FILTER_LABEL: Record<CalendarEventTypeKey, MessageId> = {
  macro: 'calendarTagMacro',
  fed: 'calendarTagFed',
  fomc: 'calendarTagFomc',
  earnings: 'calendarTagEarnings',
  holiday: 'calendarTagHoliday',
};

type CalendarSection = { title: string; data: CalendarEvent[] };

const CALENDAR_INITIAL_PAST_DAYS = 14;
const CALENDAR_WINDOW_DAYS = 90;
const CALENDAR_ALL_LOOKAHEAD_DAYS = 420;
const CALENDAR_QUERY_LIMIT = 1000;
const CALENDAR_EMPTY_WINDOW_HOPS = 4;

function calendarEventTimeLabel(ev: CalendarEvent, t: (id: MessageId) => string): string {
  return ev.time || '—';
}

function formatCalendarMetric(n: number | null | undefined, unit?: string): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const body = Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : String(n);
  return unit ? `${body}${unit}` : body;
}

function calendarSurpriseLabel(ev: CalendarEvent, t: (id: MessageId) => string): string | null {
  if (ev.actual == null || ev.estimate == null || !Number.isFinite(ev.actual) || !Number.isFinite(ev.estimate)) {
    return null;
  }
  if (ev.actual > ev.estimate) return t('calendarActualAboveEstimate');
  if (ev.actual < ev.estimate) return t('calendarActualBelowEstimate');
  return t('calendarActualInlineEstimate');
}

function mergeCalendarEvents(a: CalendarEvent[], b: CalendarEvent[]): CalendarEvent[] {
  const byId = new Map<string, CalendarEvent>();
  for (const ev of [...a, ...b]) byId.set(ev.id, ev);
  return Array.from(byId.values()).sort(
    (x, y) =>
      String(x.date || '').localeCompare(String(y.date || '')) ||
      String(x.time || '').localeCompare(String(y.time || '')) ||
      x.title.localeCompare(y.title),
  );
}

function rawToCalendarEvent(raw: Parameters<typeof signalCalendarToCalendarEvent>[0]): CalendarEvent | null {
  return signalCalendarToCalendarEvent(raw);
}

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function shiftYmd(ymd: string, days: number): string {
  const d = dateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function monthFromYmd(value: string): { year: number; month: number } {
  const date = dateFromYmd(value);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function selectedCalendarType(input: Set<CalendarEventTypeKey>): CalendarEventTypeKey | undefined {
  if (input.size !== 1) return undefined;
  return CALENDAR_EVENT_TYPE_ORDER.find((type) => input.has(type));
}

function calendarLookaheadDays(_input: Set<CalendarEventTypeKey>): number {
  return CALENDAR_ALL_LOOKAHEAD_DAYS;
}

function minYmd(a: string, b: string): string {
  return a <= b ? a : b;
}

function normalizeCalendarTypeSelection(input: Set<CalendarEventTypeKey>): Set<CalendarEventTypeKey> {
  if (input.size === CALENDAR_EVENT_TYPE_ORDER.length) {
    return new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
  }
  const first = CALENDAR_EVENT_TYPE_ORDER.find((type) => input.has(type));
  return first ? new Set<CalendarEventTypeKey>([first]) : new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
}

function resolveCalendarScrollTarget(
  sections: CalendarSection[],
  targetYmd: string | null,
): string | null {
  if (!targetYmd) return null;
  if (sections.some((section) => section.title === targetYmd)) return targetYmd;
  return sections.find((section) => section.title >= targetYmd)?.title || null;
}

export default function CalendarScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const loadedFromRef = useRef<string | null>(null);
  const loadedToRef = useRef<string | null>(null);
  const loadSeqRef = useRef(0);
  const [canLoadForward, setCanLoadForward] = useState(true);
  const [canLoadBackward, setCanLoadBackward] = useState(true);
  const [loadingForward, setLoadingForward] = useState(false);
  const [loadingBackward, setLoadingBackward] = useState(false);
  const [enabledTypes, setEnabledTypes] = useState(
    () => new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER),
  );
  const sectionListRef = useRef<SectionList<CalendarEvent, CalendarSection>>(null);
  const ignoreViewableUntilRef = useRef(0);
  // 위 방향 로드 중복 방지
  const isLoadingBackwardRef = useRef(false);

  useEffect(() => {
    void loadCalendarEventTypeFilter().then((saved) => {
      const next = normalizeCalendarTypeSelection(saved);
      setEnabledTypes(next);
      if (next.size !== saved.size) void saveCalendarEventTypeFilter(next);
    });
  }, []);

  const [selectedYmd, setSelectedYmd] = useState(() => toYmd(new Date()));
  const [anchorYmd, setAnchorYmd] = useState(() => toYmd(new Date()));
  const [pendingScrollYmd, setPendingScrollYmd] = useState<string | null>(() => toYmd(new Date()));
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromYmd(toYmd(new Date())));

  const typeParam = selectedCalendarType(enabledTypes);

  const fetchDateWindow = useCallback(
    async (from: string, to: string, forceRefresh?: boolean) => {
      const raw = await fetchSignalCalendar(
        {
          from,
          to,
          type: typeParam,
          limit: CALENDAR_QUERY_LIMIT,
        },
        { cacheMode: forceRefresh ? 'bypass' : 'use' },
      );
      return raw
        .map(rawToCalendarEvent)
        .filter((ev): ev is CalendarEvent => ev != null);
    },
    [typeParam],
  );

  const loadAroundAnchor = useCallback(
    async (anchor: string, forceRefresh?: boolean) => {
      const seq = loadSeqRef.current;
      setError(null);
      if (!hasSignalApi()) {
        setEvents([]);
        loadedFromRef.current = null;
        loadedToRef.current = null;
        setCanLoadForward(false);
        setCanLoadBackward(false);
        setError(t('errorSignalApiShort'));
        return;
      }

      const maxTo = shiftYmd(anchor, calendarLookaheadDays(enabledTypes));
      const initialFrom = shiftYmd(anchor, -CALENDAR_INITIAL_PAST_DAYS);
      let from = initialFrom;
      let to = minYmd(shiftYmd(anchor, CALENDAR_WINDOW_DAYS), maxTo);
      let merged: CalendarEvent[] = [];
      let loadedTo = to;
      let canForward = to < maxTo;

      for (let i = 0; i < CALENDAR_EMPTY_WINDOW_HOPS; i += 1) {
        const page = await fetchDateWindow(from, to, forceRefresh);
        merged = mergeCalendarEvents(merged, page);
        loadedTo = to;
        canForward = to < maxTo;
        const hasFutureTarget = merged.some((event) => String(event.date || '').slice(0, 10) >= anchor);
        if (hasFutureTarget || !canForward) break;
        from = shiftYmd(to, 1);
        to = minYmd(shiftYmd(from, CALENDAR_WINDOW_DAYS), maxTo);
      }

      if (seq !== loadSeqRef.current) return;
      setEvents(merged);
      loadedFromRef.current = initialFrom;
      loadedToRef.current = loadedTo;
      setCanLoadForward(canForward);
      setCanLoadBackward(true);
    },
    [enabledTypes, fetchDateWindow, t],
  );

  const loadMoreForward = useCallback(async () => {
    if (!hasSignalApi() || loading || refreshing || loadingForward || !canLoadForward) return;
    const loadedTo = loadedToRef.current;
    if (!loadedTo) return;
    setLoadingForward(true);
    try {
      const maxTo = shiftYmd(anchorYmd, calendarLookaheadDays(enabledTypes));
      let from = shiftYmd(loadedTo, 1);
      let to = minYmd(shiftYmd(from, CALENDAR_WINDOW_DAYS), maxTo);
      let appended: CalendarEvent[] = [];
      let nextLoadedTo = loadedTo;
      let nextCanForward = from <= maxTo;

      for (let i = 0; i < CALENDAR_EMPTY_WINDOW_HOPS && from <= maxTo; i += 1) {
        const page = await fetchDateWindow(from, to);
        appended = mergeCalendarEvents(appended, page);
        nextLoadedTo = to;
        nextCanForward = to < maxTo;
        if (page.length > 0 || !nextCanForward) break;
        from = shiftYmd(to, 1);
        to = minYmd(shiftYmd(from, CALENDAR_WINDOW_DAYS), maxTo);
      }

      setEvents((prev) => mergeCalendarEvents(prev, appended));
      loadedToRef.current = nextLoadedTo;
      setCanLoadForward(nextCanForward);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
    } finally {
      setLoadingForward(false);
    }
  }, [anchorYmd, canLoadForward, enabledTypes, fetchDateWindow, loading, loadingForward, refreshing, t]);

  const loadMoreBackward = useCallback(async () => {
    if (!hasSignalApi() || loading || refreshing || isLoadingBackwardRef.current || !canLoadBackward) return;
    const loadedFrom = loadedFromRef.current;
    if (!loadedFrom) return;
    isLoadingBackwardRef.current = true;
    setLoadingBackward(true);
    try {
      let to = shiftYmd(loadedFrom, -1);
      let from = shiftYmd(to, -CALENDAR_WINDOW_DAYS);
      let prepended: CalendarEvent[] = [];
      let nextLoadedFrom = loadedFrom;

      for (let i = 0; i < CALENDAR_EMPTY_WINDOW_HOPS; i += 1) {
        const page = await fetchDateWindow(from, to);
        prepended = mergeCalendarEvents(page, prepended);
        nextLoadedFrom = from;
        if (page.length > 0) break;
        to = shiftYmd(from, -1);
        from = shiftYmd(to, -CALENDAR_WINDOW_DAYS);
      }

      setEvents((prev) => mergeCalendarEvents(prepended, prev));
      loadedFromRef.current = nextLoadedFrom;
      setCanLoadBackward(prepended.length > 0);
    } catch (e) {
      // 위 방향 실패는 조용히 처리 (UX 방해 최소화)
    } finally {
      isLoadingBackwardRef.current = false;
      setLoadingBackward(false);
    }
  }, [canLoadBackward, fetchDateWindow, loading, refreshing]);

  useEffect(() => {
    let cancelled = false;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    (async () => {
      setLoading(true);
      try {
        await loadAroundAnchor(anchorYmd);
      } catch (e) {
        if (!cancelled && loadSeqRef.current === seq) {
          setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
          setEvents([]);
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadAroundAnchor, anchorYmd, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAroundAnchor(anchorYmd, true);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [loadAroundAnchor, anchorYmd, t]);

  // 스크롤 위치 감지 → 상단 근처면 과거 로드
  const onScroll = useCallback(
    ({ nativeEvent }: { nativeEvent: { contentOffset: { y: number } } }) => {
      if (nativeEvent.contentOffset.y < 180) {
        void loadMoreBackward();
      }
    },
    [loadMoreBackward],
  );

  const filteredEvents = useMemo(
    () => events.filter((e) => enabledTypes.has(e.type)),
    [events, enabledTypes],
  );

  const allEventTypesSelected = enabledTypes.size === CALENDAR_EVENT_TYPE_ORDER.length;
  const sections = useMemo(() => {
    if (loading) return [];
    const byDate = new Map<string, CalendarEvent[]>();
    for (const event of filteredEvents) {
      const date = String(event.date || '').slice(0, 10);
      if (!date) continue;
      const prev = byDate.get(date) || [];
      prev.push(event);
      byDate.set(date, prev);
    }
    const hasSelectedOrFutureDate = [...byDate.keys()].some((date) => date >= selectedYmd);
    if (byDate.size === 0 || !hasSelectedOrFutureDate) byDate.set(selectedYmd, []);
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || a.title.localeCompare(b.title)),
      }));
  }, [filteredEvents, loading, selectedYmd]);

  const onToggleEventType = useCallback((type: CalendarEventTypeKey) => {
    setEnabledTypes(() => {
      const next = new Set<CalendarEventTypeKey>([type]);
      void saveCalendarEventTypeFilter(next);
      return next;
    });
    setAnchorYmd(selectedYmd);
    setPendingScrollYmd(selectedYmd);
  }, [selectedYmd]);

  const onSelectAllEventTypes = useCallback(() => {
    const next = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
    setEnabledTypes(next);
    void saveCalendarEventTypeFilter(next);
    setAnchorYmd(selectedYmd);
    setPendingScrollYmd(selectedYmd);
  }, [selectedYmd]);

  const formatDayHeader = useCallback(
    (ymd: string) => {
      const p = ymd.split('-').map(Number);
      if (p.length !== 3 || p.some((x) => Number.isNaN(x))) return ymd;
      const d = new Date(p[0], p[1] - 1, p[2]);
      const loc = locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'ko-KR';
      return new Intl.DateTimeFormat(loc, {
        weekday: 'short',
        month: 'long',
        day: 'numeric',
      }).format(d);
    },
    [locale],
  );

  const todayYmd = toYmd(new Date());

  const selectYmd = useCallback((ymd: string, reloadAnchor = false) => {
    ignoreViewableUntilRef.current = Date.now() + 900;
    setSelectedYmd(ymd);
    if (reloadAnchor) setAnchorYmd(ymd);
    setPendingScrollYmd(ymd);
  }, []);

  const openCalendar = useCallback(() => {
    setCalendarMonth(monthFromYmd(selectedYmd));
    setCalendarVisible(true);
  }, [selectedYmd]);

  const pickCalendarDate = useCallback(
    (ymd: string) => {
      selectYmd(ymd, true);
      setCalendarVisible(false);
    },
    [selectYmd],
  );

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }, []);

  const goPrevDay = useCallback(() => {
    selectYmd(shiftYmd(selectedYmd, -1), true);
  }, [selectYmd, selectedYmd]);

  const goNextDay = useCallback(() => {
    selectYmd(shiftYmd(selectedYmd, 1), true);
  }, [selectYmd, selectedYmd]);

  const goToday = useCallback(() => {
    selectYmd(todayYmd, true);
    setCalendarMonth(monthFromYmd(todayYmd));
  }, [selectYmd, todayYmd]);

  const eventDates = useMemo(
    () => new Set(filteredEvents.map((event) => String(event.date || '').slice(0, 10)).filter(Boolean)),
    [filteredEvents],
  );

  const scrollTargetYmd = useMemo(
    () => resolveCalendarScrollTarget(sections, pendingScrollYmd),
    [pendingScrollYmd, sections],
  );

  const selectedSectionIndex = useMemo(
    () => sections.findIndex((section) => section.title === scrollTargetYmd),
    [scrollTargetYmd, sections],
  );

  const scrollToSelectedSection = useCallback(
    (animated = true) => {
      if (selectedSectionIndex < 0) return;
      sectionListRef.current?.scrollToLocation({
        sectionIndex: selectedSectionIndex,
        itemIndex: 0,
        viewOffset: 12,
        animated,
      });
    },
    [selectedSectionIndex],
  );

  useEffect(() => {
    if (loading || !pendingScrollYmd || !scrollTargetYmd || selectedSectionIndex < 0) return;
    const timer = setTimeout(() => {
      ignoreViewableUntilRef.current = Date.now() + 900;
      if (scrollTargetYmd !== selectedYmd) {
        setSelectedYmd(scrollTargetYmd);
      }
      scrollToSelectedSection(true);
      setTimeout(() => setPendingScrollYmd(null), 260);
    }, 40);
    return () => clearTimeout(timer);
  }, [loading, pendingScrollYmd, scrollTargetYmd, selectedYmd, selectedSectionIndex, scrollToSelectedSection]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ section?: { title?: string } }> }) => {
      if (Date.now() < ignoreViewableUntilRef.current) return;
      const first = viewableItems.find((item) => item.section?.title)?.section?.title;
      if (first) setSelectedYmd((prev) => (prev === first ? prev : first));
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current;

  const onScrollToIndexFailed = useCallback(() => {
    setTimeout(() => scrollToSelectedSection(false), 120);
  }, [scrollToSelectedSection]);

  if (!hasSignalApi()) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.errBox}>
            <Text style={styles.errText}>{t('errorSignalApiShort')}</Text>
          </View>
          <SignalBannerAd />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const emptyFiltered = !loading && !error && events.length > 0 && filteredEvents.length === 0;

  const renderEventCard = useCallback(
    (ev: CalendarEvent) => {
      const surprise = calendarSurpriseLabel(ev, t);
      const isEarnings = ev.type === 'earnings';

      const isHoliday = ev.type === 'holiday';

      const typeTagStyle = isEarnings
        ? { borderColor: theme.green + '88', backgroundColor: theme.green + '18' }
        : ev.type === 'macro'
          ? { borderColor: theme.accentBlue + '88', backgroundColor: theme.accentBlue + '22' }
          : ev.type === 'fed'
            ? { borderColor: theme.accentOrange + '77', backgroundColor: theme.accentOrange + '18' }
            : isHoliday
              ? { borderColor: theme.textMuted + '66', backgroundColor: theme.bgElevated }
              : { borderColor: theme.accentOrange + 'CC', backgroundColor: theme.accentOrange + '30' };

      const typeTagTextStyle = isEarnings
        ? { color: theme.green }
        : ev.type === 'macro'
          ? { color: theme.accentBlue }
          : isHoliday
            ? { color: theme.textMuted }
            : { color: theme.accentOrange };

      const typeTagLabel = isEarnings
        ? t('calendarTagEarnings')
        : ev.type === 'fomc'
          ? t('calendarTagFomc')
          : ev.type === 'fed'
            ? t('calendarTagFed')
            : isHoliday
              ? t('calendarTagHoliday')
              : t('calendarTagMacro');

      return (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.titleBlock}>
              <View style={styles.titleLine}>
                <View style={[styles.typeTag, typeTagStyle]}>
                  <Text style={[styles.typeTagText, typeTagTextStyle]}>{typeTagLabel}</Text>
                </View>
                {/* 실적: 종목 심볼 뱃지 */}
                {isEarnings && ev.symbol ? (
                  <View style={styles.symbolTag}>
                    <Text style={styles.symbolTagText}>{ev.symbol}</Text>
                  </View>
                ) : null}
                {/* 매크로: 영향도 뱃지 */}
                {!isEarnings && ev.impact ? (
                  <View
                    style={[
                      styles.impactTag,
                      ev.impact === 'high' && styles.impactHigh,
                      ev.impact === 'medium' && styles.impactMedium,
                    ]}>
                    <Text
                      style={[
                        styles.impactTagText,
                        ev.impact === 'high' && { color: theme.accentOrange },
                        ev.impact === 'medium' && { color: theme.accentBlue },
                      ]}>
                      {ev.impact === 'high'
                        ? t('calendarImpactHigh')
                        : ev.impact === 'medium'
                          ? t('calendarImpactMedium')
                          : t('calendarImpactLow')}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.title} numberOfLines={3}>
                  {ev.title}
                </Text>
              </View>
              {/* 실적: 회계연도 + 발표 시간대 */}
              {isEarnings && (ev.fiscalYear != null || ev.earningsHour) ? (
                <View style={styles.metricRow}>
                  {ev.fiscalYear != null && ev.fiscalQuarter != null ? (
                    <Text style={styles.metricText}>
                      FY{ev.fiscalYear} Q{ev.fiscalQuarter}
                    </Text>
                  ) : null}
                  {ev.earningsHour ? (
                    <Text style={styles.metricText}>{ev.earningsHour}</Text>
                  ) : null}
                </View>
              ) : null}
              {/* EPS / 지표 수치 */}
              {(ev.actual != null || ev.estimate != null || ev.prev != null) ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricText}>
                    {isEarnings ? 'EPS ' : ''}{t('calendarMetricActual')}: {formatCalendarMetric(ev.actual, ev.unit)}
                  </Text>
                  <Text style={styles.metricText}>
                    {t('calendarMetricEstimate')}: {formatCalendarMetric(ev.estimate, ev.unit)}
                  </Text>
                  {!isEarnings ? (
                    <Text style={styles.metricText}>
                      {t('calendarMetricPrevious')}: {formatCalendarMetric(ev.prev, ev.unit)}
                    </Text>
                  ) : null}
                </View>
              ) : null}
              {surprise ? <Text style={styles.surpriseText}>{surprise}</Text> : null}
            </View>
            <Text style={styles.time}>{calendarEventTimeLabel(ev, t)}</Text>
          </View>
        </View>
      );
    },
    [styles, t, theme],
  );

  const renderListEmpty = useCallback(() => {
    if (loading) {
      return (
        <View style={SCROLL_LOADING_BODY_STYLE}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      );
    }
    if (error) return null;
    return (
      <Text style={styles.empty}>
        {emptyFiltered ? t('calendarFilterEmptyFiltered') : t('calendarScreenEmptyDay')}
      </Text>
    );
  }, [emptyFiltered, error, loading, styles, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.fixedTop}>
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}
        <SignalDateNavigator
          label={formatDayHeader(selectedYmd)}
          previousA11y={t('calendarMonthPrevA11y')}
          nextA11y={t('calendarMonthNextA11y')}
          labelA11y={t('insightOpenCalendar')}
          todayLabel={t('insightCalendarToday')}
          onPrevious={goPrevDay}
          onNext={goNextDay}
          onPressLabel={openCalendar}
          onToday={goToday}
          showToday={selectedYmd !== todayYmd}
        />
        <View style={styles.filterChips} accessibilityRole="tablist">
          <Pressable
            onPress={onSelectAllEventTypes}
            style={[
              styles.filterChip,
              allEventTypesSelected && styles.filterChipActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: allEventTypesSelected }}>
            <Text
              style={[
                styles.filterChipText,
                allEventTypesSelected && styles.filterChipTextActive,
              ]}>
              {t('calendarFilterAll')}
            </Text>
          </Pressable>
          {CALENDAR_EVENT_TYPE_ORDER.map((type) => {
            const active = !allEventTypesSelected && enabledTypes.has(type);
            return (
              <Pressable
                key={type}
                onPress={() => onToggleEventType(type)}
                style={[styles.filterChip, active && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}>
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {t(CALENDAR_FILTER_LABEL[type])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <SectionList
        ref={sectionListRef}
        style={styles.listScroll}
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderEventCard(item)}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.monthHeading}>{formatDayHeader(section.title)}</Text>
          </View>
        )}
        renderSectionFooter={({ section }) =>
          section.data.length === 0 ? (
            <Text style={styles.empty}>
              {emptyFiltered ? t('calendarFilterEmptyFiltered') : t('calendarScreenEmptyDay')}
            </Text>
          ) : null
        }
        ListHeaderComponent={
          loadingBackward ? (
            <View style={styles.loadMore}>
              <SignalLoadingIndicator message={t('commonLoading')} />
            </View>
          ) : null
        }
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          <View>
            {loadingForward ? (
              <View style={styles.loadMore}>
                <SignalLoadingIndicator message={t('commonLoading')} />
              </View>
            ) : null}
            <SignalBannerAd />
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollToIndexFailed={onScrollToIndexFailed}
        onEndReached={loadMoreForward}
        onEndReachedThreshold={0.45}
        onScroll={onScroll}
        scrollEventThrottle={200}
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        contentContainerStyle={[
          styles.listContent,
          loading ? SCROLL_CONTENT_LOADING_STYLE : null,
          { paddingBottom: 28 + insets.bottom + 56 },
          sections.length === 0 && !loading ? styles.listContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      <Modal
        animationType="slide"
        transparent
        visible={calendarVisible}
        onRequestClose={() => setCalendarVisible(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCalendarVisible(false)} />
          <View style={styles.modalSheet}>
            <View style={styles.modalGrab} />
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('insightCalendarTitle')}</Text>
              <Pressable
                onPress={() => setCalendarVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('calendarFilterClose')}
                hitSlop={8}>
                <Text style={styles.modalClose}>{t('calendarFilterClose')}</Text>
              </Pressable>
            </View>
            <InvestMonthCalendar
              year={calendarMonth.year}
              month={calendarMonth.month}
              selectedYmd={selectedYmd}
              eventDates={eventDates}
              onSelectYmd={pickCalendarDate}
              onPrevMonth={() => shiftCalendarMonth(-1)}
              onNextMonth={() => shiftCalendarMonth(1)}
              monthPrevA11y={t('calendarMonthPrevA11y')}
              monthNextA11y={t('calendarMonthNextA11y')}
              todayYmd={todayYmd}
              theme={theme}
              locale={locale}
              compact
            />
            <View style={styles.modalFoot}>
              <Pressable
                onPress={() => {
                  goToday();
                  setCalendarVisible(false);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [styles.modalTodayBtn, pressed && styles.dateActionBtnPressed]}>
                <Text style={styles.modalTodayText}>{t('insightCalendarToday')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    scroll: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 28 },
    fixedTop: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
    },
    listScroll: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 10 },
    listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
    dateActionBtnPressed: { opacity: 0.86 },
    sectionHeader: {
      backgroundColor: theme.bg,
      paddingTop: 4,
      paddingBottom: 2,
    },
    monthHeading: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
    },
    filterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 10,
    },
    filterChip: {
      minHeight: 30,
      paddingHorizontal: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterChipActive: {
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    filterChipText: {
      fontSize: sf(11),
      lineHeight: sf(16),
      fontWeight: '800',
      color: theme.textDim,
    },
    filterChipTextActive: {
      color: theme.green,
    },
    errBox: {
      padding: 10,
      borderRadius: 14,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      marginBottom: 8,
    },
    errText: { fontSize: sf(11), color: theme.danger, lineHeight: sf(16) },
    empty: { fontSize: sf(12), color: theme.textMuted, paddingVertical: 12, textAlign: 'center' },
    loadMore: {
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginBottom: 6,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    titleBlock: { flex: 1, minWidth: 0 },
    titleLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: 6,
    },
    typeTag: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
    },
    typeTagText: { fontSize: sf(9), fontWeight: '800' },
    impactTag: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    impactHigh: {
      borderColor: theme.accentOrange + '88',
      backgroundColor: theme.accentOrange + '1A',
    },
    impactMedium: {
      borderColor: theme.accentBlue + '77',
      backgroundColor: theme.accentBlue + '18',
    },
    impactTagText: { fontSize: sf(9), fontWeight: '800', color: theme.textMuted },
    symbolTag: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
      borderColor: theme.green + '88',
      backgroundColor: theme.green + '18',
    },
    symbolTagText: { fontSize: sf(9), fontWeight: '900', color: theme.green },
    time: { fontSize: sf(10), color: theme.textMuted, marginTop: 1, flexShrink: 0 },
    title: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(18),
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 7,
    },
    metricText: { fontSize: sf(10), fontWeight: '700', color: theme.textMuted },
    surpriseText: {
      marginTop: 6,
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.textDim,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.58)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.bg,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    modalGrab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 10,
      marginBottom: 8,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    modalTitle: {
      color: theme.text,
      fontSize: sf(17),
      fontWeight: '900',
    },
    modalClose: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '900',
    },
    modalFoot: { paddingTop: 10 },
    modalTodayBtn: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTodayText: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '900',
    },
  });
}
