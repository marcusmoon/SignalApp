import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { SCROLL_CONTENT_LOADING_STYLE, SCROLL_LOADING_BODY_STYLE } from '@/constants/scrollLoadingLayout';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
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
  earnings: 'calendarTagEarnings',
  macro: 'calendarTagMacro',
  fed: 'calendarTagFed',
  fomc: 'calendarTagFomc',
};

function calendarEventTimeLabel(ev: CalendarEvent, t: (id: MessageId) => string): string {
  const code = ev.earningsHourCode;
  if (!code) return ev.time || '—';
  if (code === 'bmo') return t('briefingEarnHourBmo');
  if (code === 'amc') return t('briefingEarnHourAmc');
  if (code === 'dmh' || code === 'dmt') return t('calendarEarningsHourIntraday');
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

function ymdInMonth(ymd: string, year: number, month0: number): boolean {
  const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}-`;
  return ymd.startsWith(prefix);
}

function mergeCalendarEvents(chunks: CalendarEvent[][]): CalendarEvent[] {
  const byId = new Map<string, CalendarEvent>();
  for (const chunk of chunks) {
    for (const event of chunk) {
      byId.set(event.id, event);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
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
  const [enabledTypes, setEnabledTypes] = useState(
    () => new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER),
  );

  useEffect(() => {
    void loadCalendarEventTypeFilter().then(setEnabledTypes);
  }, []);

  const [visibleMonth, setVisibleMonth] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });
  const [selectedYmd, setSelectedYmd] = useState(() => toYmd(new Date()));

  useEffect(() => {
    setSelectedYmd((prev) => {
      if (ymdInMonth(prev, visibleMonth.year, visibleMonth.month)) {
        return prev;
      }
      const now = new Date();
      if (now.getFullYear() === visibleMonth.year && now.getMonth() === visibleMonth.month) {
        return toYmd(now);
      }
      return toYmd(new Date(visibleMonth.year, visibleMonth.month, 1));
    });
  }, [visibleMonth]);

  const load = useCallback(
    async (forceRefresh?: boolean) => {
      setError(null);
      if (!hasSignalApi()) {
        setEvents([]);
        setError(t('errorSignalApiShort'));
        return;
      }
      const rangeFrom = new Date(visibleMonth.year, visibleMonth.month, 1);
      const rangeTo = new Date(visibleMonth.year, visibleMonth.month + 1, 0);
      const monthParams = {
        from: toYmd(rangeFrom),
        to: toYmd(rangeTo),
      };
      const selectedDayParams = ymdInMonth(selectedYmd, visibleMonth.year, visibleMonth.month)
        ? { from: selectedYmd, to: selectedYmd }
        : null;
      const [monthList, selectedDayList] = await Promise.all([
        fetchSignalCalendar(monthParams, { cacheMode: forceRefresh ? 'bypass' : 'use' }),
        selectedDayParams
          ? fetchSignalCalendar(selectedDayParams, { cacheMode: forceRefresh ? 'bypass' : 'use' })
          : Promise.resolve([]),
      ]);
      setEvents(
        mergeCalendarEvents([
          monthList.map(signalCalendarToCalendarEvent),
          selectedDayList.map(signalCalendarToCalendarEvent),
        ]),
      );
    },
    [selectedYmd, visibleMonth, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
          setEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

  useEffect(() => {
    if (loading || !hasSignalApi() || !ymdInMonth(selectedYmd, visibleMonth.year, visibleMonth.month)) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchSignalCalendar({ from: selectedYmd, to: selectedYmd });
        if (cancelled || rows.length === 0) return;
        const next = rows.map(signalCalendarToCalendarEvent);
        setEvents((prev) => mergeCalendarEvents([prev, next]));
      } catch {
        // 월 조회는 이미 완료된 상태라, 날짜 보강 실패는 화면 전체 오류로 올리지 않는다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, selectedYmd, visibleMonth]);

  const filteredEvents = useMemo(
    () => events.filter((e) => enabledTypes.has(e.type)),
    [events, enabledTypes],
  );

  const allEventTypesSelected = enabledTypes.size === CALENDAR_EVENT_TYPE_ORDER.length;
  const eventDates = useMemo(() => new Set(filteredEvents.map((e) => e.date)), [filteredEvents]);
  const selectedDayEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => event.date === selectedYmd)
        .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')) || a.title.localeCompare(b.title)),
    [filteredEvents, selectedYmd],
  );

  const onToggleEventType = useCallback((type: CalendarEventTypeKey) => {
    setEnabledTypes((prev) => {
      const isAllMode = prev.size === CALENDAR_EVENT_TYPE_ORDER.length;
      let next = isAllMode ? new Set<CalendarEventTypeKey>([type]) : new Set(prev);
      if (!isAllMode && next.has(type)) {
        next.delete(type);
      } else if (!isAllMode) {
        next.add(type);
      }
      if (next.size === 0 || next.size === CALENDAR_EVENT_TYPE_ORDER.length) {
        next = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
      }
      void saveCalendarEventTypeFilter(next);
      return next;
    });
  }, []);

  const onSelectAllEventTypes = useCallback(() => {
    const next = new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER);
    setEnabledTypes(next);
    void saveCalendarEventTypeFilter(next);
  }, []);

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

  const goPrevMonth = useCallback(() => {
    setVisibleMonth((v) => {
      const d = new Date(v.year, v.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

  const goNextMonth = useCallback(() => {
    setVisibleMonth((v) => {
      const d = new Date(v.year, v.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }, []);

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

      return (
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.titleBlock}>
              <View style={styles.titleLine}>
                <View
                  style={[
                    styles.typeTag,
                    ev.type === 'earnings' && {
                      borderColor: theme.green + '88',
                      backgroundColor: theme.green + '22',
                    },
                    ev.type === 'macro' && {
                      borderColor: theme.accentBlue + '88',
                      backgroundColor: theme.accentBlue + '22',
                    },
                    ev.type === 'fed' && {
                      borderColor: theme.accentOrange + '77',
                      backgroundColor: theme.accentOrange + '18',
                    },
                    ev.type === 'fomc' && {
                      borderColor: theme.accentOrange + 'CC',
                      backgroundColor: theme.accentOrange + '30',
                    },
                  ]}>
                  <Text
                    style={[
                      styles.typeTagText,
                      ev.type === 'earnings' && { color: theme.green },
                      ev.type === 'macro' && { color: theme.accentBlue },
                      ev.type === 'fed' && { color: theme.accentOrange },
                      ev.type === 'fomc' && { color: theme.accentOrange },
                    ]}>
                    {ev.type === 'earnings'
                      ? t('calendarTagEarnings')
                      : ev.type === 'fomc'
                        ? t('calendarTagFomc')
                        : ev.type === 'fed'
                          ? t('calendarTagFed')
                          : t('calendarTagMacro')}
                  </Text>
                </View>
                {ev.impact ? (
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
              {ev.type !== 'earnings' &&
              (ev.actual != null || ev.estimate != null || ev.prev != null) ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricText}>
                    {t('calendarMetricActual')}: {formatCalendarMetric(ev.actual, ev.unit)}
                  </Text>
                  <Text style={styles.metricText}>
                    {t('calendarMetricEstimate')}: {formatCalendarMetric(ev.estimate, ev.unit)}
                  </Text>
                  <Text style={styles.metricText}>
                    {t('calendarMetricPrevious')}: {formatCalendarMetric(ev.prev, ev.unit)}
                  </Text>
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
        <InvestMonthCalendar
          year={visibleMonth.year}
          month={visibleMonth.month}
          selectedYmd={selectedYmd}
          eventDates={eventDates}
          onSelectYmd={setSelectedYmd}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
          monthPrevA11y={t('calendarMonthPrevA11y')}
          monthNextA11y={t('calendarMonthNextA11y')}
          todayYmd={todayYmd}
          theme={theme}
          locale={locale}
          compact
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
      <FlatList
        style={styles.listScroll}
        data={selectedDayEvents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderEventCard(item)}
        ListHeaderComponent={<Text style={styles.monthHeading}>{formatDayHeader(selectedYmd)}</Text>}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={<SignalBannerAd />}
        contentContainerStyle={[
          styles.listContent,
          loading ? SCROLL_CONTENT_LOADING_STYLE : null,
          { paddingBottom: 28 + insets.bottom + 56 },
          selectedDayEvents.length === 0 && !loading ? styles.listContentEmpty : null,
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
    listScroll: { flex: 1, minHeight: 0 },
    listContent: { paddingHorizontal: 16, paddingTop: 10 },
    listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
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
