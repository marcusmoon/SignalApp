import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from "expo-router/react-navigation";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
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

const CALENDAR_MONTH_QUERY_LIMIT = 1000;

function calendarEventTimeLabel(ev: CalendarEvent): string {
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

function rawToCalendarEvent(raw: Parameters<typeof signalCalendarToCalendarEvent>[0]): CalendarEvent | null {
  return signalCalendarToCalendarEvent(raw);
}

function dateFromYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function monthFromYmd(value: string): { year: number; month: number } {
  const date = dateFromYmd(value);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function monthBounds(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: toYmd(first), to: toYmd(last) };
}

/** 현재 달이면 오늘 or 가장 가까운 미래 날짜, 다른 달이면 첫 번째 이벤트 날짜 */
function resolveAutoSelectYmd(
  year: number,
  month: number,
  eventDates: Set<string>,
  todayYmd: string,
): string {
  const sorted = [...eventDates].sort();
  if (sorted.length === 0) {
    return toYmd(new Date(year, month, 1));
  }
  const todayMonth = toYmd(new Date()).slice(0, 7);
  const viewMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  if (viewMonthStr === todayMonth) {
    // 오늘 이벤트 있으면 오늘
    if (eventDates.has(todayYmd)) return todayYmd;
    // 오늘 이후 가장 가까운 날
    const future = sorted.find((d) => d > todayYmd);
    if (future) return future;
    // 없으면 마지막 날짜
    return sorted[sorted.length - 1];
  }
  return sorted[0];
}

function normalizeCalendarTypeSelection(input: Set<CalendarEventTypeKey>): Set<CalendarEventTypeKey> {
  if (input.size === CALENDAR_EVENT_TYPE_ORDER.length) {
    return new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
  }
  const first = CALENDAR_EVENT_TYPE_ORDER.find((type) => input.has(type));
  return first ? new Set<CalendarEventTypeKey>([first]) : new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
}

function selectedCalendarType(input: Set<CalendarEventTypeKey>): CalendarEventTypeKey | undefined {
  if (input.size !== 1) return undefined;
  return CALENDAR_EVENT_TYPE_ORDER.find((type) => input.has(type));
}

export default function CalendarScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const todayYmd = toYmd(new Date());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);

  // 현재 보는 달의 모든 이벤트 (서버에서 받아온 원본)
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);

  const [enabledTypes, setEnabledTypes] = useState(
    () => new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER),
  );

  // 현재 보고 있는 달
  const [viewMonth, setViewMonth] = useState(() => monthFromYmd(todayYmd));
  // 선택된 날짜
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);

  const loadSeqRef = useRef(0);

  useEffect(() => {
    void loadCalendarEventTypeFilter().then((saved) => {
      const next = normalizeCalendarTypeSelection(saved);
      setEnabledTypes(next);
      if (next.size !== saved.size) void saveCalendarEventTypeFilter(next);
    });
  }, []);

  const typeParam = selectedCalendarType(enabledTypes);

  // 해당 달 이벤트 fetch
  const fetchMonthData = useCallback(
    async (year: number, month: number, forceRefresh?: boolean) => {
      const { from, to } = monthBounds(year, month);
      const raw = await fetchSignalCalendar(
        { from, to, type: typeParam, limit: CALENDAR_MONTH_QUERY_LIMIT },
        { cacheMode: forceRefresh ? 'bypass' : 'use' },
      );
      return raw.map(rawToCalendarEvent).filter((ev): ev is CalendarEvent => ev != null);
    },
    [typeParam],
  );

  // viewMonth 또는 typeParam 변경 시 해당 월 데이터 로드
  useEffect(() => {
    if (!hasSignalApi()) return;
    let cancelled = false;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const events = await fetchMonthData(viewMonth.year, viewMonth.month);
        if (cancelled || loadSeqRef.current !== seq) return;
        setMonthEvents(events);
        // 클라이언트 필터 적용해서 이벤트 날짜 계산
        const filtered = events.filter((e) => enabledTypes.has(e.type));
        const eventDates = new Set(filtered.map((e) => String(e.date || '').slice(0, 10)).filter(Boolean));
        const autoSelect = resolveAutoSelectYmd(viewMonth.year, viewMonth.month, eventDates, todayYmd);
        setSelectedYmd(autoSelect);
      } catch (e) {
        if (!cancelled && loadSeqRef.current === seq) {
          setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
          setMonthEvents([]);
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMonth.year, viewMonth.month, typeParam]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const events = await fetchMonthData(viewMonth.year, viewMonth.month, true);
      setMonthEvents(events);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [fetchMonthData, viewMonth.year, viewMonth.month, t]);

  // 클라이언트 필터 적용
  const filteredEvents = useMemo(
    () => monthEvents.filter((e) => enabledTypes.has(e.type)),
    [monthEvents, enabledTypes],
  );

  // 미니 캘린더용: 이벤트 있는 날짜 Set
  const eventDates = useMemo(
    () => new Set(filteredEvents.map((e) => String(e.date || '').slice(0, 10)).filter(Boolean)),
    [filteredEvents],
  );

  // 선택 날짜의 이벤트만 (FlatList용)
  const dayEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => String(e.date || '').slice(0, 10) === selectedYmd)
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || a.title.localeCompare(b.title)),
    [filteredEvents, selectedYmd],
  );

  const allEventTypesSelected = enabledTypes.size === CALENDAR_EVENT_TYPE_ORDER.length;

  const onToggleEventType = useCallback((type: CalendarEventTypeKey) => {
    const next = new Set<CalendarEventTypeKey>([type]);
    void saveCalendarEventTypeFilter(next);
    setEnabledTypes(next);
  }, []);

  const onSelectAllEventTypes = useCallback(() => {
    const next = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
    setEnabledTypes(next);
    void saveCalendarEventTypeFilter(next);
  }, []);

  // 필터 변경 시 선택 날짜 재조정
  useEffect(() => {
    if (loading) return;
    const filtered = monthEvents.filter((e) => enabledTypes.has(e.type));
    const dates = new Set(filtered.map((e) => String(e.date || '').slice(0, 10)).filter(Boolean));
    if (dates.size === 0) return;
    // 현재 선택 날짜에 이벤트 없으면 재조정
    if (!dates.has(selectedYmd)) {
      setSelectedYmd(resolveAutoSelectYmd(viewMonth.year, viewMonth.month, dates, todayYmd));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabledTypes]);

  const onPrevMonth = useCallback(() => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const onNextMonth = useCallback(() => {
    setViewMonth((prev) => {
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const goToday = useCallback(() => {
    const today = monthFromYmd(todayYmd);
    setViewMonth(today);
    setSelectedYmd(todayYmd);
  }, [todayYmd]);

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

  const emptyFiltered = !loading && !error && monthEvents.length > 0 && filteredEvents.length === 0;

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
                {isEarnings && ev.symbol ? (
                  <View style={styles.symbolTag}>
                    <Text style={styles.symbolTagText}>{ev.symbol}</Text>
                  </View>
                ) : null}
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
            <Text style={styles.time}>{calendarEventTimeLabel(ev)}</Text>
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

  const isCurrentMonth = (() => {
    const cm = monthFromYmd(todayYmd);
    return viewMonth.year === cm.year && viewMonth.month === cm.month;
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}

      {/* 상단 필터 */}
      <View style={styles.fixedTop}>
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}
        <View style={styles.filterChips} accessibilityRole="tablist">
          <Pressable
            onPress={onSelectAllEventTypes}
            style={[styles.filterChip, allEventTypesSelected && styles.filterChipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: allEventTypesSelected }}>
            <Text style={[styles.filterChipText, allEventTypesSelected && styles.filterChipTextActive]}>
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

      {/* 미니 캘린더 (항상 보임) */}
      <View style={styles.calendarWrapper}>
        <InvestMonthCalendar
          year={viewMonth.year}
          month={viewMonth.month}
          selectedYmd={selectedYmd}
          eventDates={eventDates}
          onSelectYmd={setSelectedYmd}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          monthPrevA11y={t('calendarMonthPrevA11y')}
          monthNextA11y={t('calendarMonthNextA11y')}
          todayYmd={todayYmd}
          theme={theme}
          locale={locale}
        />
        {!isCurrentMonth ? (
          <Pressable
            onPress={goToday}
            accessibilityRole="button"
            style={({ pressed }) => [styles.todayBtn, pressed && styles.todayBtnPressed]}>
            <Text style={styles.todayBtnText}>{t('insightCalendarToday')}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 선택 날짜 헤더 */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeadingText}>{formatDayHeader(selectedYmd)}</Text>
        {dayEvents.length > 0 ? (
          <Text style={styles.dayHeadingCount}>{dayEvents.length}</Text>
        ) : null}
      </View>

      {/* 선택 날짜 이벤트 리스트 */}
      <FlatList
        style={styles.listScroll}
        data={dayEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderEventCard(item)}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          <View style={{ paddingBottom: 28 + insets.bottom + 56 }}>
            <SignalBannerAd />
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          loading ? SCROLL_CONTENT_LOADING_STYLE : null,
          dayEvents.length === 0 && !loading ? styles.listContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
      />
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
    calendarWrapper: {
      paddingHorizontal: 8,
      paddingBottom: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
    },
    todayBtn: {
      alignSelf: 'center',
      marginTop: 2,
      marginBottom: 6,
      paddingHorizontal: 18,
      paddingVertical: 7,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    todayBtnPressed: { opacity: 0.8 },
    todayBtnText: {
      color: theme.green,
      fontSize: sf(13),
      fontWeight: '800',
    },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 6,
    },
    dayHeadingText: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
      flex: 1,
    },
    dayHeadingCount: {
      fontSize: sf(11),
      fontWeight: '700',
      color: theme.textMuted,
    },
    listScroll: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 4 },
    listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
    filterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
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
  });
}
