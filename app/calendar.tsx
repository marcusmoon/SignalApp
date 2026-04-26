import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { BlurView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarEventTypeFilterModal } from '@/components/signal/CalendarEventTypeFilterModal';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import type { AppTheme } from '@/constants/theme';
import { useResetRefreshingOnTabBlur } from '@/hooks';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCalendarEventsMergedCached } from '@/integrations/finnhub/calendarCache';
import {
  CALENDAR_EVENT_TYPE_ORDER,
  loadCalendarEventTypeFilter,
  saveCalendarEventTypeFilter,
  type CalendarEventTypeKey,
} from '@/services/calendarEventTypeFilterPreference';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { loadCalendarConcallScope } from '@/services/calendarConcallScopePreference';
import { hasFinnhub, useSignalApiBackend } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { fetchSignalCalendar, signalCalendarToCalendarEvent } from '@/integrations/signal-api';
import { toYmd } from '@/utils/date';
import type { MessageId } from '@/locales/messages';
import type { CalendarEvent } from '@/types/signal';

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
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const signalApiMode = useSignalApiBackend();

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
      if (signalApiMode) {
        const rangeFrom = new Date(visibleMonth.year, visibleMonth.month, 1);
        const rangeTo = new Date(visibleMonth.year, visibleMonth.month + 1, 0);
        const list = await fetchSignalCalendar({
          from: toYmd(rangeFrom),
          to: toYmd(rangeTo),
        });
        setEvents(list.map(signalCalendarToCalendarEvent));
        return;
      }

      if (!hasFinnhub()) {
        setEvents([]);
        setError(t('errorFinnhubTokenShort'));
        return;
      }
      const scope = await loadCalendarConcallScope();
      const watch = scope === 'watch' ? await loadWatchlistSymbols() : undefined;
      const { calendarEnabled } = await loadCacheFeaturePrefs();
      const rangeFrom = new Date(visibleMonth.year, visibleMonth.month, 1);
      const rangeTo = new Date(visibleMonth.year, visibleMonth.month + 1, 0);
      const list = await fetchCalendarEventsMergedCached(
        14,
        { scope, watchlistSymbols: watch, rangeFrom, rangeTo },
        { cacheEnabled: calendarEnabled, forceRefresh: !!forceRefresh },
      );
      setEvents(list);
    },
    [signalApiMode, visibleMonth, t],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t('calendarErrorLoad'));
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
      setError(e instanceof Error ? e.message : t('feedErrorRefresh'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

  const filteredEvents = useMemo(
    () => events.filter((e) => enabledTypes.has(e.type)),
    [events, enabledTypes],
  );

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
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size <= 1) return prev;
        next.delete(type);
      } else {
        next.add(type);
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

  const filterReady = !loading;

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

  if (!signalApiMode && !hasFinnhub()) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.errBox}>
            <Text style={styles.errText}>{t('errorFinnhubTokenShort')}</Text>
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
    if (loading) return <Text style={styles.loading}>{t('commonLoading')}</Text>;
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
          { paddingBottom: 28 + insets.bottom + 56 },
          selectedDayEvents.length === 0 && !loading ? styles.listContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        updateCellsBatchingPeriod={32}
        windowSize={7}
        removeClippedSubviews={Platform.OS !== 'web'}
      />

      {filterReady ? (
        <Pressable
          onPress={() => setFilterModalVisible(true)}
          style={({ pressed }) => [
            styles.filterFab,
            { bottom: insets.bottom + 16 },
            pressed && styles.filterFabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('a11yCalendarFilter')}>
          {Platform.OS === 'web' ? (
            <View style={styles.filterFabBlurFallback} />
          ) : (
            <BlurView
              intensity={Platform.OS === 'ios' ? 100 : 85}
              tint="dark"
              experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
              style={StyleSheet.absoluteFill}
            />
          )}
          <View pointerEvents="none" style={styles.filterFabRing} />
          <FontAwesome name="filter" size={19} color={theme.green} />
        </Pressable>
      ) : null}

      <CalendarEventTypeFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        enabled={enabledTypes}
        onToggle={onToggleEventType}
        onSelectAll={onSelectAllEventTypes}
        bottomInset={insets.bottom}
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
      paddingBottom: 10,
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
    loading: { fontSize: sf(12), color: theme.textMuted, marginBottom: 8, paddingVertical: 4 },
    errBox: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 8,
    },
    errText: { fontSize: sf(11), color: '#E0A0A0', lineHeight: sf(16) },
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
    filterFab: {
      position: 'absolute',
      right: 16,
      width: 52,
      height: 52,
      borderRadius: 26,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 10,
    },
    filterFabBlurFallback: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(10,10,15,0.88)',
      borderRadius: 26,
    },
    filterFabRing: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 26,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    filterFabPressed: {
      opacity: 0.9,
    },
  });
}
