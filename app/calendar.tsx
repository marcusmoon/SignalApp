import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type FlatList,
  type ListRenderItem,
} from 'react-native';
import { useIsFocused } from "expo-router/react-navigation";
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { WideSubpaneHeader } from '@/components/layout/WideSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { signalDrillStackOptions } from '@/components/layout/signalDrillStackOptions';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { SectionCapRule } from '@/components/signal/SectionCapRule';
import { SourceIconStack } from '@/components/signal/SourceIconStack';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { WebWheelFlatList } from '@/components/layout/WebWheelFlatList';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { APP_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
  SCREEN_FIXED_HEADER_PADDING_TOP,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  stackScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import { getSegmentTabBarStyles } from '@/constants/segmentTabBar';
import {
  BOTTOM_SHEET_BACKDROP_COLOR,
  BOTTOM_SHEET_MAX_HEIGHT,
} from '@/constants/bottomSheetLayout';
import { UI_RADIUS_SHEET } from '@/constants/uiCornerRadius';
import { COMFORT_PADDING_ROW_V } from '@/constants/comfortDensity';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import {
  fetchSignalCalendarScreenRange,
  signalCalendarToCalendarEvent,
} from '@/integrations/signal-api';
import {
  calendarDayFetchBounds,
  calendarMonthFetchBounds,
  calendarRangeContains,
} from '@/domain/calendar/calendarFetchBounds';
import { mergeCalendarEvents } from '@/domain/calendar/mergeCalendarEvents';
import { filterCalendarEarningsToWatchlist } from '@/domain/calendar/calendarWatchlistEarnings';
import {
  buildCalendarDayListRows,
  calendarEventSectionKey,
  calendarEventShortTitle,
  filterMeaningfulCalendarEvents,
  sortCalendarDayEvents,
  type CalendarDayListRow,
  type CalendarDaySectionKey,
} from '@/domain/calendar/calendarEventRelevance';
import {
  CALENDAR_VIEW_FILTER_ORDER,
  calendarViewFetchType,
  calendarViewFilterTypes,
  calendarViewShowsDaySections,
  calendarViewUsesMeaningfulScope,
  type CalendarViewFilterKey,
} from '@/domain/calendar/calendarViewFilter';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import {
  loadCalendarViewFilter,
  saveCalendarViewFilter,
} from '@/services/calendarViewFilterPreference';
import type { AppLocale, MessageId } from '@/locales/messages';
import { calendarProviderSourceEntries } from '@/domain/calendar/calendarProviderIcon';
import { calendarTypeAccent } from '@/domain/calendar/typeAccent';
import type { CalendarEvent } from '@/types/signal';
import { localeTagForAppLocale, toYmd, calendarEventDisplayYmd } from '@/utils/date';

const CALENDAR_VIEW_FILTER_LABEL: Record<CalendarViewFilterKey, MessageId> = {
  meaningful: 'calendarScopeMeaningful',
  macro: 'calendarTagMacro',
  earnings: 'calendarSegEarnings',
  policy: 'calendarTagFed',
  holiday: 'calendarSegHoliday',
  full: 'calendarFilterAll',
};

function calendarEventTimeLabel(ev: CalendarEvent, locale: AppLocale): string {
  if (ev.time) return ev.time;
  if (!ev.eventAt || !ev.timezone) return '—';
  try {
    const label =
      ev.timezone === 'America/New_York' ? 'ET' : ev.timezone === 'Asia/Seoul' ? 'KST' : ev.timezone === 'UTC' ? 'UTC' : '';
    const time = new Intl.DateTimeFormat(localeTagForAppLocale(locale), {
      timeZone: ev.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(ev.eventAt));
    return label ? `${time} ${label}` : time;
  } catch {
    return '—';
  }
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

function shiftYmd(ymd: string, days: number): string {
  const d = dateFromYmd(ymd);
  d.setDate(d.getDate() + days);
  return toYmd(d);
}

function monthFromYmd(value: string): { year: number; month: number } {
  const date = dateFromYmd(value);
  return { year: date.getFullYear(), month: date.getMonth() };
}

const CALENDAR_SECTION_LABEL: Record<CalendarDaySectionKey, MessageId> = {
  policy: 'calendarSectionPolicy',
  macro: 'calendarSectionMacro',
  earnings: 'calendarSectionEarnings',
  holiday: 'calendarSectionHoliday',
};

export type CalendarScreenProps = {
  embedded?: boolean;
  fromAccount?: boolean;
  onBack?: () => void;
};

export default function CalendarScreen({
  embedded = false,
  fromAccount: fromAccountProp,
  onBack,
}: CalendarScreenProps = {}) {
  const { theme, scaleFont, feedTypo } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont, feedTypo), [theme, scaleFont, feedTypo]);
  const router = useRouter();
  const ipadNav = useIpadSidebarNav();
  const { useTwoPane } = useResponsiveLayout();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const fromAccount =
    fromAccountProp ??
    (Array.isArray(params.from) ? params.from[0] : params.from) === 'account';

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  const returnToAccountHub = useCallback(() => {
    if (ipadNav.isAvailable) {
      ipadNav.showAccount();
      return;
    }
    router.replace('/account' as never);
  }, [ipadNav, router]);

  const subpaneBack = onBack ?? (fromAccount ? returnToAccountHub : undefined);

  if (useTwoPane && !embedded) {
    return (
      <WideOverlayRouteRedirect
        kind="calendar"
        params={fromAccount ? { from: 'account' } : {}}
      />
    );
  }

  const wrapWide = useCallback(
    (body: ReactNode) => {
      if (!useTwoPane) {
        return (
          <>
            <Stack.Screen
              options={signalDrillStackOptions({
                title: t('screenCalendar'),
                onBack: () => router.back(),
              })}
            />
            {body}
          </>
        );
      }
      return body;
    },
    [router, t, useTwoPane],
  );

  const todayYmd = toYmd(new Date());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);

  const [gridEvents, setGridEvents] = useState<CalendarEvent[]>([]);
  const [daySupplementEvents, setDaySupplementEvents] = useState<CalendarEvent[]>([]);
  const gridEventsRef = useRef<CalendarEvent[]>([]);
  gridEventsRef.current = gridEvents;
  const monthEvents = useMemo(
    () => mergeCalendarEvents([gridEvents, daySupplementEvents]),
    [gridEvents, daySupplementEvents],
  );
  const monthEventsRef = useRef<CalendarEvent[]>([]);
  monthEventsRef.current = monthEvents;
  const [viewMonth, setViewMonth] = useState(() => monthFromYmd(todayYmd));
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [viewFilter, setViewFilter] = useState<CalendarViewFilterKey>('meaningful');

  useEffect(() => {
    void loadCalendarViewFilter().then(setViewFilter);
  }, []);

  const loadSeqRef = useRef(0);
  const supplementSeqRef = useRef(0);

  const monthRange = useMemo(
    () => calendarMonthFetchBounds(viewMonth.year, viewMonth.month),
    [viewMonth.year, viewMonth.month],
  );
  const dayRange = useMemo(() => calendarDayFetchBounds(selectedYmd), [selectedYmd]);
  const needsDaySupplement = useMemo(
    () => !calendarRangeContains(monthRange, dayRange),
    [monthRange, dayRange],
  );

  const typeParam = calendarViewFetchType(viewFilter);
  const enabledTypes = useMemo(() => new Set(calendarViewFilterTypes(viewFilter)), [viewFilter]);
  const { ref: listRef } = useScrollToTopOnChange([selectedYmd, viewFilter], {
    skipInitial: false,
    resyncDeps: [monthEvents, selectedYmd],
  });
  const listScrollResetKey = `${selectedYmd}:${viewFilter}`;

  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);

  useEffect(() => {
    if (!isFocused) return;
    void loadWatchlistSymbols().then(setWatchlistSymbols);
  }, [isFocused]);

  const mapCalendarRows = useCallback(
    (raw: Parameters<typeof signalCalendarToCalendarEvent>[0][]) =>
      filterCalendarEarningsToWatchlist(
        raw.map(rawToCalendarEvent).filter((ev): ev is CalendarEvent => ev != null),
        watchlistSymbols,
      ),
    [watchlistSymbols],
  );

  const fetchRangeEvents = useCallback(
    async (from: string, to: string, forceRefresh?: boolean) => {
      const raw = await fetchSignalCalendarScreenRange(
        {
          from,
          to,
          watchlistSymbols,
          typeFilter: typeParam,
        },
        { cacheMode: signalCacheMode(forceRefresh) },
      );
      return mapCalendarRows(raw);
    },
    [mapCalendarRows, typeParam, watchlistSymbols],
  );

  const loadGridEvents = useCallback(
    async (forceRefresh?: boolean) => fetchRangeEvents(monthRange.from, monthRange.to, forceRefresh),
    [fetchRangeEvents, monthRange.from, monthRange.to],
  );

  const loadDaySupplementEvents = useCallback(
    async (forceRefresh?: boolean) => fetchRangeEvents(dayRange.from, dayRange.to, forceRefresh),
    [dayRange.from, dayRange.to, fetchRangeEvents],
  );

  useEffect(() => {
    if (!hasSignalApi()) return;
    let cancelled = false;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    (async () => {
      const hadEvents = gridEventsRef.current.length > 0;
      if (!hadEvents) setLoading(true);
      setError(null);
      try {
        const events = await loadGridEvents();
        if (cancelled || loadSeqRef.current !== seq) return;
        setGridEvents(events);
      } catch (e) {
        if (!cancelled && loadSeqRef.current === seq) {
          setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
          setGridEvents([]);
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGridEvents, t]);

  useEffect(() => {
    if (!hasSignalApi()) return;
    if (!needsDaySupplement) {
      setDaySupplementEvents([]);
      return;
    }
    let cancelled = false;
    const seq = supplementSeqRef.current + 1;
    supplementSeqRef.current = seq;
    (async () => {
      try {
        const events = await loadDaySupplementEvents();
        if (cancelled || supplementSeqRef.current !== seq) return;
        setDaySupplementEvents(events);
      } catch {
        if (!cancelled && supplementSeqRef.current === seq) {
          setDaySupplementEvents([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadDaySupplementEvents, needsDaySupplement]);

  const onRefreshBase = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [grid, supplement] = await Promise.all([
        loadGridEvents(true),
        needsDaySupplement ? loadDaySupplementEvents(true) : Promise.resolve([] as CalendarEvent[]),
      ]);
      setGridEvents(grid);
      setDaySupplementEvents(supplement);
    } catch (e) {
      setError(formatSignalApiError(e, t, 'feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [loadDaySupplementEvents, loadGridEvents, needsDaySupplement, t]);

  const onRefresh = onRefreshBase;

  const displayEvents = useMemo(() => {
    const rows = monthEvents.filter((event) => enabledTypes.has(event.type));
    if (calendarViewUsesMeaningfulScope(viewFilter)) {
      return filterMeaningfulCalendarEvents(rows, watchlistSymbols);
    }
    return sortCalendarDayEvents(rows);
  }, [enabledTypes, monthEvents, viewFilter, watchlistSymbols]);

  const filteredEvents = displayEvents;

  const eventDates = useMemo(
    () => new Set(filteredEvents.map((e) => calendarEventDisplayYmd(e)).filter(Boolean)),
    [filteredEvents],
  );

  const selectedDayEvents = useMemo(
    () => filteredEvents.filter((event) => calendarEventDisplayYmd(event) === selectedYmd),
    [filteredEvents, selectedYmd],
  );

  const dayListRows = useMemo(
    () =>
      calendarViewShowsDaySections(viewFilter)
        ? buildCalendarDayListRows(selectedDayEvents)
        : selectedDayEvents.map((event) => ({ kind: 'event' as const, id: event.id, event })),
    [selectedDayEvents, viewFilter],
  );

  const selectedDayHeading = useMemo(
    () => formatDayHeaderLabel(selectedYmd, locale),
    [locale, selectedYmd],
  );

  const emptyFiltered = !loading && !error && monthEvents.length > 0 && filteredEvents.length === 0;
  const emptyDayMessage = calendarViewUsesMeaningfulScope(viewFilter)
    ? t('calendarScreenEmptyDayMeaningful')
    : t('calendarScreenEmptyDay');
  const emptyFilterMessage = calendarViewUsesMeaningfulScope(viewFilter)
    ? t('calendarFilterEmptyMeaningful')
    : t('calendarFilterEmptyFiltered');

  const onSelectViewFilter = useCallback((filter: CalendarViewFilterKey) => {
    setViewFilter(filter);
    void saveCalendarViewFilter(filter);
  }, []);

  const selectYmd = useCallback((ymd: string) => {
    setSelectedYmd(ymd);
    setViewMonth(monthFromYmd(ymd));
  }, []);

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

  const shiftSelectedDay = useCallback((delta: -1 | 1) => {
    selectYmd(shiftYmd(selectedYmd, delta));
  }, [selectYmd, selectedYmd]);

  const onPrevDay = useCallback(() => shiftSelectedDay(-1), [shiftSelectedDay]);
  const onNextDay = useCallback(() => shiftSelectedDay(1), [shiftSelectedDay]);

  const goToday = useCallback(() => {
    selectYmd(todayYmd);
  }, [selectYmd, todayYmd]);

  const openCalendar = useCallback(() => {
    setViewMonth(monthFromYmd(selectedYmd));
    setCalendarVisible(true);
  }, [selectedYmd]);

  const closeCalendar = useCallback(() => {
    setViewMonth(monthFromYmd(selectedYmd));
    setCalendarVisible(false);
  }, [selectedYmd]);

  const pickCalendarDate = useCallback(
    (ymd: string) => {
      selectYmd(ymd);
      setCalendarVisible(false);
    },
    [selectYmd],
  );

  const renderListEmpty = useCallback(() => {
    if (loading && selectedDayEvents.length === 0) {
      return (
        <View style={styles.emptyDayBox}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      );
    }
    if (error) return null;
    return (
      <View style={styles.emptyDayBox}>
        <Text style={styles.emptyDayText}>
          {emptyFiltered ? emptyFilterMessage : emptyDayMessage}
        </Text>
      </View>
    );
  }, [emptyFiltered, emptyDayMessage, emptyFilterMessage, error, loading, selectedDayEvents.length, styles.emptyDayBox, styles.emptyDayText, t]);

  const sectionCounts = useMemo(() => {
    const counts: Partial<Record<CalendarDaySectionKey, number>> = {};
    for (const event of selectedDayEvents) {
      const key = calendarEventSectionKey(event);
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [selectedDayEvents]);

  const renderDayRow = useCallback<ListRenderItem<CalendarDayListRow>>(
    ({ item }) => {
      if (item.kind === 'header') {
        const count = sectionCounts[item.section];
        return (
          <View style={styles.dayGroupHeader}>
            <SectionCapRule
              label={t(CALENDAR_SECTION_LABEL[item.section])}
              meta={count ? String(count) : null}
              accessibilityRole="header"
            />
          </View>
        );
      }
      return (
        <CalendarEventRow
          ev={item.event}
          theme={theme}
          cardStyles={styles}
          t={t}
          locale={locale}
          showTypeTag={calendarViewShowsDaySections(viewFilter)}
        />
      );
    },
    [locale, sectionCounts, styles, t, theme, viewFilter],
  );

  const listKeyExtractor = useCallback((item: CalendarDayListRow) => item.id, []);

  const listHeader = useMemo(
    () => <View style={styles.listTopSpacer} />,
    [styles.listTopSpacer],
  );

  const showTodayNav = selectedYmd !== todayYmd;

  if (!hasSignalApi()) {
    return wrapWide(
      <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <WebWheelScrollView
          contentContainerStyle={[
            styles.scroll,
            useTwoPane && styles.scrollWide,
            { paddingBottom: stackScreenScrollBottomPadding(insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}>
          {subpaneBack ? (
            <View style={styles.subpaneHeaderPad}>
              <WideSubpaneHeader title={t('screenCalendar')} onBack={subpaneBack} />
            </View>
          ) : null}
          <View style={styles.errBox}>
            <Text style={styles.errText}>{t('errorSignalApiShort')}</Text>
          </View>
          <SignalBannerAd />
        </WebWheelScrollView>
      </SafeAreaView>,
    );
  }

  return wrapWide(
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}

      <View style={[styles.pageColumn, useTwoPane && styles.pageColumnWide]}>
        {subpaneBack ? (
          <View style={styles.subpaneHeaderPad}>
            <WideSubpaneHeader title={t('screenCalendar')} onBack={subpaneBack} />
          </View>
        ) : null}
      <View style={[styles.fixedTop, useTwoPane && styles.fixedTopWide]}>
        {error ? (
          <View style={styles.errBox}>
            <Text style={styles.errText}>{error}</Text>
          </View>
        ) : null}
        <SignalDateNavigator
          label={selectedDayHeading}
          labelA11y={selectedDayHeading}
          previousA11y={t('calendarDayPrevA11y')}
          nextA11y={t('calendarDayNextA11y')}
          todayLabel={t('insightCalendarToday')}
          onPrevious={onPrevDay}
          onNext={onNextDay}
          onPressLabel={openCalendar}
          onToday={goToday}
          showToday={showTodayNav}
        />
        <View style={styles.segment} accessibilityRole="tablist">
          {CALENDAR_VIEW_FILTER_ORDER.map((filter) => {
            const active = viewFilter === filter;
            return (
              <Pressable
                key={filter}
                onPress={() => onSelectViewFilter(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.segBtn, active && styles.segBtnActive]}>
                <Text style={[styles.segText, active && styles.segTextActive]} numberOfLines={1}>
                  {t(CALENDAR_VIEW_FILTER_LABEL[filter])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <WebWheelFlatList
        scrollResetKey={listScrollResetKey}
        ref={listRef as never}
        style={styles.listScroll}
        data={loading && dayListRows.length === 0 ? [] : dayListRows}
        keyExtractor={listKeyExtractor}
        renderItem={renderDayRow}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          <View style={{ paddingBottom: stackScreenScrollBottomPadding(insets.bottom) }}>
            <SignalBannerAd />
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        animationType="slide"
        transparent
        visible={calendarVisible}
        onRequestClose={closeCalendar}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeCalendar} />
          <View style={styles.modalSheet}>
            <View style={styles.modalGrab} />
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>{t('insightCalendarTitle')}</Text>
              <Pressable
                onPress={closeCalendar}
                accessibilityRole="button"
                accessibilityLabel={t('calendarFilterClose')}
                hitSlop={8}>
                <Text style={styles.modalClose}>{t('calendarFilterClose')}</Text>
              </Pressable>
            </View>
            <InvestMonthCalendar
              year={viewMonth.year}
              month={viewMonth.month}
              selectedYmd={selectedYmd}
              eventDates={eventDates}
              onSelectYmd={pickCalendarDate}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
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
      </View>
    </SafeAreaView>,
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number, ft: FeedContentTypography) {
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  const segmentTab = getSegmentTabBarStyles(theme, sf);
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    pageColumn: {
      flex: 1,
      minHeight: 0,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    pageColumnWide: {
      ...wideContentFill,
    },
    scroll: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      paddingBottom: stackScreenScrollBottomPadding(0),
    },
    scrollWide: {
      ...wideContentFill,
    },
    subpaneHeaderPad: {
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingTop: SCREEN_FIXED_HEADER_PADDING_TOP,
    },
    fixedTop: {
      ...fixedHeader.strip,
      width: '100%',
    },
    fixedTopWide: {
      ...fixedHeader.stripWide,
    },
    listTopSpacer: {
      height: SCREEN_LIST_CONTENT_PADDING_TOP,
    },
    listLoadingRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 8,
    },
    dayGroupHeader: {
      paddingTop: 14,
      paddingBottom: 6,
    },
    emptyDayBox: {
      marginTop: 12,
      paddingVertical: 28,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyDayText: {
      fontSize: ft.ff(13),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: ft.ff(18),
    },
    listScroll: { flex: 1, minHeight: 0 },
    listContent: {
      width: '100%',
      paddingHorizontal: 16,
      flexGrow: 1,
    },
    segment: {
      ...segmentTab.segment,
      marginHorizontal: -SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
      paddingHorizontal: SCREEN_FIXED_HEADER_PADDING_HORIZONTAL,
    },
    segBtn: {
      ...segmentTab.segBtn,
      paddingHorizontal: 4,
    },
    segBtnActive: segmentTab.segBtnActive,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    errBox: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 8,
    },
    errText: { fontSize: sf(11), color: theme.danger, lineHeight: sf(16) },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingVertical: COMFORT_PADDING_ROW_V,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    timeCol: {
      width: 64,
      paddingTop: 1,
    },
    time: {
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textDim,
      fontVariant: ['tabular-nums'],
    },
    bodyCol: {
      flex: 1,
      minWidth: 0,
      gap: 3,
    },
    titleLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
    },
    typeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      flexShrink: 0,
    },
    typeLabel: {
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.metaWeight,
      flexShrink: 0,
    },
    title: {
      flex: 1,
      minWidth: 0,
      fontSize: ft.ff(15),
      fontWeight: ft.titleWeight,
      color: theme.text,
      lineHeight: ft.ff(20),
    },
    subtitle: {
      fontSize: ft.ff(12),
      lineHeight: ft.ff(16),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    metricText: {
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    surpriseText: {
      fontSize: ft.ff(11),
      lineHeight: ft.ff(15),
      fontWeight: ft.emphasisWeight,
      color: theme.textDim,
    },
    sourceFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: BOTTOM_SHEET_BACKDROP_COLOR,
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: UI_RADIUS_SHEET,
      borderTopRightRadius: UI_RADIUS_SHEET,
      borderWidth: StyleSheet.hairlineWidth,
      borderBottomWidth: 0,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingBottom: 12,
      maxHeight: BOTTOM_SHEET_MAX_HEIGHT,
    },
    modalGrab: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginTop: 10,
      marginBottom: 6,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    modalTitle: {
      color: theme.text,
      fontSize: sf(16),
      fontWeight: '700',
    },
    modalClose: {
      color: theme.green,
      fontSize: sf(13),
      fontWeight: '700',
    },
    modalFoot: {
      marginTop: 8,
      alignItems: 'center',
    },
    modalTodayBtn: {
      minHeight: 40,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTodayText: {
      color: theme.green,
      fontSize: sf(13),
      fontWeight: '700',
    },
    dateActionBtnPressed: { opacity: 0.86 },
  });
}

type CalendarCardStyles = ReturnType<typeof makeStyles>;

function formatDayHeaderLabel(ymd: string, locale: AppLocale): string {
  const p = ymd.split('-').map(Number);
  if (p.length !== 3 || p.some((x) => Number.isNaN(x))) return ymd;
  const d = new Date(p[0], p[1] - 1, p[2]);
  const loc = locale === 'ja' ? 'ja-JP' : locale === 'en' ? 'en-US' : 'ko-KR';
  return new Intl.DateTimeFormat(loc, {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

type CalendarEventRowProps = {
  ev: CalendarEvent;
  theme: AppTheme;
  cardStyles: CalendarCardStyles;
  t: (id: MessageId) => string;
  locale: AppLocale;
  showTypeTag: boolean;
};

const CalendarEventRow = memo(function CalendarEventRow({
  ev,
  theme,
  cardStyles: styles,
  t,
  locale,
  showTypeTag,
}: CalendarEventRowProps) {
  const surprise = calendarSurpriseLabel(ev, t);
  const isEarnings = ev.type === 'earnings';
  const isHoliday = ev.type === 'holiday';
  const sourceEntries = calendarProviderSourceEntries(ev.provider);
  const accent = calendarTypeAccent(theme, ev.type);

  const typeTagLabel = isEarnings
    ? t('calendarTagEarnings')
    : ev.type === 'fomc'
      ? t('calendarTagFomc')
      : ev.type === 'fed'
        ? t('calendarTagFed')
        : isHoliday
          ? t('calendarTagHoliday')
          : t('calendarTagMacro');

  const displayTitle = calendarEventShortTitle(ev, typeTagLabel);
  const showFullTitle =
    displayTitle.trim().toLowerCase() !== ev.title.trim().toLowerCase() && ev.title.trim().length > 0;

  const timeLabel = calendarEventTimeLabel(ev, locale);
  const impactLabel =
    !isEarnings && ev.impact === 'high'
      ? t('calendarImpactHigh')
      : !isEarnings && ev.impact === 'medium'
        ? t('calendarImpactMedium')
        : null;

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={styles.time} numberOfLines={2}>
          {timeLabel}
        </Text>
      </View>
      <View style={styles.bodyCol}>
        <View style={styles.titleLine}>
          <View style={[styles.typeDot, { backgroundColor: accent }]} />
          {showTypeTag ? (
            <Text style={[styles.typeLabel, { color: accent }]} numberOfLines={1}>
              {typeTagLabel}
            </Text>
          ) : null}
          <Text style={styles.title} numberOfLines={2}>
            {displayTitle}
          </Text>
        </View>
        {showFullTitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {ev.title}
          </Text>
        ) : null}
        {isEarnings && (ev.fiscalYear != null || ev.earningsHour) ? (
          <View style={styles.metricRow}>
            {ev.fiscalYear != null && ev.fiscalQuarter != null ? (
              <Text style={styles.metricText}>
                FY{ev.fiscalYear} Q{ev.fiscalQuarter}
              </Text>
            ) : null}
            {ev.earningsHour ? <Text style={styles.metricText}>{ev.earningsHour}</Text> : null}
          </View>
        ) : null}
        {impactLabel ? <Text style={styles.metricText}>{impactLabel}</Text> : null}
        {ev.actual != null || ev.estimate != null || ev.prev != null ? (
          <View style={styles.metricRow}>
            <Text style={styles.metricText}>
              {isEarnings ? 'EPS ' : ''}
              {t('calendarMetricActual')} {formatCalendarMetric(ev.actual, ev.unit)}
            </Text>
            <Text style={styles.metricText}>
              {t('calendarMetricEstimate')} {formatCalendarMetric(ev.estimate, ev.unit)}
            </Text>
            {!isEarnings ? (
              <Text style={styles.metricText}>
                {t('calendarMetricPrevious')} {formatCalendarMetric(ev.prev, ev.unit)}
              </Text>
            ) : null}
          </View>
        ) : null}
        {surprise ? <Text style={styles.surpriseText}>{surprise}</Text> : null}
        {sourceEntries.length > 0 ? (
          <View style={styles.sourceFooter}>
            <SourceIconStack sources={sourceEntries} size={16} maxVisible={2} />
          </View>
        ) : null}
      </View>
    </View>
  );
});

