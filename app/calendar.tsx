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

import { AccountSubpaneHeader } from '@/components/account/AccountSubpaneHeader';
import { WideOverlayRouteRedirect } from '@/components/layout/WideOverlayRouteRedirect';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
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
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur, useScrollToTopOnChange } from '@/hooks';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import type { FeedContentTypography } from '@/services/feedContentWeightPreference';
import {
  fetchSignalCalendar,
  signalCalendarToCalendarEvent,
} from '@/integrations/signal-api';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { hasSignalApi } from '@/services/env';
import {
  CALENDAR_EVENT_TYPE_ORDER,
  loadCalendarEventTypeFilter,
  saveCalendarEventTypeFilter,
  type CalendarEventTypeKey,
} from '@/services/calendarEventTypeFilterPreference';
import type { AppLocale, MessageId } from '@/locales/messages';
import { calendarProviderSourceEntries } from '@/domain/calendar/calendarProviderIcon';
import type { CalendarEvent } from '@/types/signal';
import { localeTagForAppLocale, toYmd, calendarEventDisplayYmd } from '@/utils/date';

const CALENDAR_FILTER_LABEL: Record<CalendarEventTypeKey, MessageId> = {
  macro: 'calendarTagMacro',
  fed: 'calendarTagFed',
  fomc: 'calendarTagFomc',
  earnings: 'calendarTagEarnings',
  holiday: 'calendarTagHoliday',
};

const CALENDAR_MONTH_QUERY_LIMIT = 1000;

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

function monthBounds(year: number, month: number): { from: string; to: string } {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Pad by one day so US market-date earnings (amc) that fall on the next local day are included.
  return { from: shiftYmd(toYmd(first), -1), to: shiftYmd(toYmd(last), 1) };
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

function sortDayEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      calendarEventDisplayYmd(a).localeCompare(calendarEventDisplayYmd(b)) ||
      (a.eventAt && b.eventAt ? String(a.eventAt).localeCompare(String(b.eventAt)) : 0) ||
      String(a.time || '').localeCompare(String(b.time || '')) ||
      a.title.localeCompare(b.title),
  );
}

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
            <Stack.Screen options={{ title: t('screenCalendar') }} />
            {body}
          </>
        );
      }
      return body;
    },
    [t, useTwoPane],
  );

  const todayYmd = toYmd(new Date());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  useResetRefreshingOnTabBlur(setRefreshing);
  const [error, setError] = useState<string | null>(null);

  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const monthEventsRef = useRef<CalendarEvent[]>([]);
  monthEventsRef.current = monthEvents;
  const [enabledTypes, setEnabledTypes] = useState(
    () => new Set<CalendarEventTypeKey>(CALENDAR_EVENT_TYPE_ORDER),
  );
  const [viewMonth, setViewMonth] = useState(() => monthFromYmd(todayYmd));
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [calendarVisible, setCalendarVisible] = useState(false);

  const loadSeqRef = useRef(0);

  useEffect(() => {
    void loadCalendarEventTypeFilter().then((saved) => {
      const next = normalizeCalendarTypeSelection(saved);
      setEnabledTypes(next);
      if (next.size !== saved.size) void saveCalendarEventTypeFilter(next);
    });
  }, []);

  const typeParam = selectedCalendarType(enabledTypes);
  const { ref: listRef } = useScrollToTopOnChange([selectedYmd, typeParam], {
    skipInitial: false,
    resyncDeps: [monthEvents, selectedYmd],
  });
  const listScrollResetKey = `${selectedYmd}:${typeParam}`;

  const fetchMonthData = useCallback(
    async (year: number, month: number, forceRefresh?: boolean) => {
      const { from, to } = monthBounds(year, month);
      const raw = await fetchSignalCalendar(
        { from, to, type: typeParam, limit: CALENDAR_MONTH_QUERY_LIMIT },
        { cacheMode: signalCacheMode(forceRefresh) },
      );
      return raw.map(rawToCalendarEvent).filter((ev): ev is CalendarEvent => ev != null);
    },
    [typeParam],
  );

  useEffect(() => {
    if (!hasSignalApi()) return;
    let cancelled = false;
    const seq = loadSeqRef.current + 1;
    loadSeqRef.current = seq;
    (async () => {
      const hadEvents = monthEventsRef.current.length > 0;
      if (!hadEvents) setLoading(true);
      setError(null);
      try {
        const events = await fetchMonthData(viewMonth.year, viewMonth.month);
        if (cancelled || loadSeqRef.current !== seq) return;
        setMonthEvents(events);
      } catch (e) {
        if (!cancelled && loadSeqRef.current === seq) {
          setError(formatSignalApiError(e, t, 'calendarErrorLoad'));
          setMonthEvents([]);
        }
      } finally {
        if (!cancelled && loadSeqRef.current === seq) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [fetchMonthData, t, viewMonth.year, viewMonth.month]);

  const onRefreshBase = useCallback(async () => {
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

  const onRefresh = onRefreshBase;

  const filteredEvents = useMemo(
    () => monthEvents.filter((e) => enabledTypes.has(e.type)),
    [monthEvents, enabledTypes],
  );

  const eventDates = useMemo(
    () => new Set(filteredEvents.map((e) => calendarEventDisplayYmd(e)).filter(Boolean)),
    [filteredEvents],
  );

  const selectedDayEvents = useMemo(
    () =>
      sortDayEvents(
        filteredEvents.filter((e) => calendarEventDisplayYmd(e) === selectedYmd),
      ),
    [filteredEvents, selectedYmd],
  );

  const selectedDayHeading = useMemo(
    () => formatDayHeaderLabel(selectedYmd, locale),
    [locale, selectedYmd],
  );

  const emptyFiltered = !loading && !error && monthEvents.length > 0 && filteredEvents.length === 0;
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
          {emptyFiltered ? t('calendarFilterEmptyFiltered') : t('calendarScreenEmptyDay')}
        </Text>
      </View>
    );
  }, [emptyFiltered, error, loading, selectedDayEvents.length, styles.emptyDayBox, styles.emptyDayText, t]);

  const renderEventItem = useCallback<ListRenderItem<CalendarEvent>>(
    ({ item }) => <CalendarEventCard ev={item} theme={theme} cardStyles={styles} t={t} locale={locale} />,
    [locale, styles, t, theme],
  );

  const listKeyExtractor = useCallback((item: CalendarEvent) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View style={styles.daySection}>
        <Text style={styles.daySectionMeta}>
          {selectedDayEvents.length > 0
            ? `${t('calendarScreenSectionTitle')} · ${selectedDayEvents.length}`
            : t('calendarScreenSectionTitle')}
        </Text>
      </View>
    ),
    [selectedDayEvents.length, styles.daySection, styles.daySectionMeta, t],
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
              <AccountSubpaneHeader title={t('screenCalendar')} onBack={subpaneBack} />
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
            <AccountSubpaneHeader title={t('screenCalendar')} onBack={subpaneBack} />
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

      <WebWheelFlatList
        scrollResetKey={listScrollResetKey}
        ref={listRef as never}
        style={styles.listScroll}
        data={loading && selectedDayEvents.length === 0 ? [] : selectedDayEvents}
        keyExtractor={listKeyExtractor}
        renderItem={renderEventItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          <View style={{ paddingBottom: stackScreenScrollBottomPadding(insets.bottom) + 56 }}>
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
    daySection: {
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
      paddingBottom: 8,
    },
    listLoadingRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: 8,
    },
    daySectionMeta: {
      fontSize: ft.ff(11),
      fontWeight: ft.metaWeight,
      color: theme.textMuted,
    },
    emptyDayBox: {
      marginTop: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 22,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyDayText: {
      fontSize: ft.ff(13),
      fontWeight: ft.bodyWeight,
      color: theme.textMuted,
      textAlign: 'center',
      lineHeight: ft.ff(19),
    },
    listScroll: { flex: 1, minHeight: 0 },
    listContent: {
      width: '100%',
      paddingHorizontal: 16,
      flexGrow: 1,
    },
    filterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 16,
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
      fontWeight: '600',
      color: theme.textDim,
    },
    filterChipTextActive: {
      color: theme.green,
    },
    errBox: {
      padding: 10,
      borderRadius: 8,
      backgroundColor: theme.dangerDim,
      borderWidth: 1,
      borderColor: '#FFD6DA',
      marginBottom: 8,
    },
    errText: { fontSize: sf(11), color: theme.danger, lineHeight: sf(16) },
    card: {
      backgroundColor: theme.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 10,
      paddingVertical: 10,
      marginBottom: 6,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 16,
    },
    titleBlock: { flex: 1, minWidth: 0 },
    titleLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'flex-start',
      gap: 8,
    },
    typeTag: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
    },
    typeTagText: { fontSize: sf(9), fontWeight: '600' },
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
    impactTagText: { fontSize: sf(9), fontWeight: '600', color: theme.textMuted },
    symbolTag: {
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginTop: 1,
      borderColor: theme.green + '88',
      backgroundColor: theme.green + '18',
    },
    symbolTagText: { fontSize: sf(9), fontWeight: '700', color: theme.green },
    time: { fontSize: ft.ff(10), fontWeight: ft.metaWeight, color: theme.textMuted, marginTop: 1, flexShrink: 0 },
    title: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      fontSize: ft.ff(13),
      fontWeight: ft.titleWeight,
      color: theme.text,
      lineHeight: ft.ff(18),
    },
    metricRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 7,
    },
    metricText: { fontSize: ft.ff(10), fontWeight: ft.metaWeight, color: theme.textMuted },
    surpriseText: {
      marginTop: 6,
      fontSize: ft.ff(10),
      fontWeight: ft.emphasisWeight,
      color: theme.textDim,
    },
    sourceFooter: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      marginTop: 16,
      marginBottom: 8,
    },
    modalHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    modalTitle: {
      color: theme.text,
      fontSize: sf(17),
      fontWeight: '700',
    },
    modalClose: {
      color: theme.green,
      fontSize: sf(14),
      fontWeight: '700',
    },
    modalFoot: { paddingTop: 10 },
    modalTodayBtn: {
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalTodayText: {
      color: theme.green,
      fontSize: sf(14),
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

type CalendarEventCardProps = {
  ev: CalendarEvent;
  theme: AppTheme;
  cardStyles: CalendarCardStyles;
  t: (id: MessageId) => string;
  locale: AppLocale;
};

const CalendarEventCard = memo(function CalendarEventCard({
  ev,
  theme,
  cardStyles: styles,
  t,
  locale,
}: CalendarEventCardProps) {
  const surprise = calendarSurpriseLabel(ev, t);
  const isEarnings = ev.type === 'earnings';
  const isHoliday = ev.type === 'holiday';
  const sourceEntries = calendarProviderSourceEntries(ev.provider);

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
              {ev.earningsHour ? <Text style={styles.metricText}>{ev.earningsHour}</Text> : null}
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
          {sourceEntries.length > 0 ? (
            <View style={styles.sourceFooter}>
              <SourceIconStack sources={sourceEntries} size={18} maxVisible={2} />
            </View>
          ) : null}
        </View>
        <Text style={styles.time}>{calendarEventTimeLabel(ev, locale)}</Text>
      </View>
    </View>
  );
});
