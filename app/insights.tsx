import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { InsightCard } from '@/components/signal/InsightCard';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchSignalInsights } from '@/integrations/signal-api';
import type { SignalApiInsight } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { addDays, toYmd } from '@/utils/date';

const PAGE_SIZE = 20;
const CLIENT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function parseYmd(value: string): Date {
  const [y, m, d] = value.split('-').map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return new Date();
  return new Date(y, m - 1, d);
}

function shiftYmd(value: string, days: number): string {
  return toYmd(addDays(parseYmd(value), days));
}

function localeForDate(locale: 'ko' | 'en' | 'ja'): string {
  if (locale === 'en') return 'en-US';
  if (locale === 'ja') return 'ja-JP';
  return 'ko-KR';
}

function formatSelectedDate(value: string, locale: 'ko' | 'en' | 'ja'): string {
  try {
    return new Intl.DateTimeFormat(localeForDate(locale), {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(parseYmd(value));
  } catch {
    return value;
  }
}

function monthFromYmd(value: string): { year: number; month: number } {
  const date = parseYmd(value);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export default function InsightsScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const nextOffsetRef = useRef(0);
  const todayYmd = useMemo(() => toYmd(new Date()), []);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromYmd(todayYmd));
  const [items, setItems] = useState<SignalApiInsight[]>([]);
  const [watchlistSymbols, setWatchlistSymbols] = useState<string[]>([]);
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedDateLabel = useMemo(() => formatSelectedDate(selectedYmd, locale), [locale, selectedYmd]);
  const selectedIsToday = selectedYmd >= todayYmd;
  const activeWatchlistSymbols = watchlistOnly && watchlistSymbols.length > 0 ? watchlistSymbols : undefined;

  useEffect(() => {
    let cancelled = false;
    loadWatchlistSymbols()
      .then((symbols) => {
        if (!cancelled) setWatchlistSymbols(symbols);
      })
      .catch(() => {
        if (!cancelled) setWatchlistSymbols([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadFirstPage = useCallback(
    async ({ refresh = false, cancelled = () => false }: { refresh?: boolean; cancelled?: () => boolean } = {}) => {
      if (!hasSignalApi()) {
        setItems([]);
        setHasMore(false);
        setError(t('errorSignalApiShort'));
        setLoading(false);
        return;
      }
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        nextOffsetRef.current = 0;
        const { items: rows, meta } = await fetchSignalInsights({
          date: 'all',
          from: selectedYmd,
          to: selectedYmd,
          timeZone: CLIENT_TIME_ZONE,
          symbols: activeWatchlistSymbols,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (cancelled()) return;
        setItems(rows);
        nextOffsetRef.current = rows.length;
        setHasMore(meta.hasMore);
      } catch (e) {
        if (!cancelled()) {
          setError(e instanceof Error ? e.message : t('insightListError'));
          setItems([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled()) {
          if (refresh) setRefreshing(false);
          else setLoading(false);
        }
      }
    },
    [activeWatchlistSymbols, selectedYmd, t],
  );

  useEffect(() => {
    let cancelled = false;
    void loadFirstPage({ cancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasSignalApi() || !hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const off = nextOffsetRef.current;
      const { items: rows, meta } = await fetchSignalInsights({
        date: 'all',
        from: selectedYmd,
        to: selectedYmd,
        timeZone: CLIENT_TIME_ZONE,
        symbols: activeWatchlistSymbols,
        limit: PAGE_SIZE,
        offset: off,
      });
      setItems((prev) => [...prev, ...rows]);
      nextOffsetRef.current = off + rows.length;
      setHasMore(meta.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [activeWatchlistSymbols, hasMore, loading, loadingMore, selectedYmd]);

  const onRefresh = useCallback(async () => {
    await loadFirstPage({ refresh: true });
  }, [loadFirstPage]);

  const moveDate = useCallback(
    (days: number) => {
      setSelectedYmd((prev) => {
        const next = shiftYmd(prev, days);
        return next > todayYmd ? todayYmd : next;
      });
    },
    [todayYmd],
  );

  const openCalendar = useCallback(() => {
    setCalendarMonth(monthFromYmd(selectedYmd));
    setCalendarVisible(true);
  }, [selectedYmd]);

  const pickCalendarDate = useCallback(
    (ymd: string) => {
      setSelectedYmd(ymd > todayYmd ? todayYmd : ymd);
      setCalendarVisible(false);
    },
    [todayYmd],
  );

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }, []);

  const goToday = useCallback(() => {
    setSelectedYmd(todayYmd);
    setCalendarMonth(monthFromYmd(todayYmd));
  }, [todayYmd]);

  const listFooter =
    loadingMore ? (
      <View style={styles.footerLoading}>
        <ActivityIndicator color={theme.green} />
        <Text style={styles.footerMuted}>{t('feedLoadingMore')}</Text>
      </View>
    ) : null;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <OtaUpdateBanner />
      <View style={styles.header}>
        <Text style={styles.lead}>{t('insightListLead')}</Text>
        <View style={styles.datePicker}>
          <View style={styles.datePickerTop}>
            <Pressable
              onPress={() => moveDate(-1)}
              accessibilityRole="button"
              accessibilityLabel={t('insightDatePrevious')}
              hitSlop={8}
              style={({ pressed }) => [styles.dateArrow, pressed && styles.dateArrowPressed]}>
              <FontAwesome name="chevron-left" size={13} color={theme.green} />
            </Pressable>
            <View style={styles.datePickerCenter}>
              <Text style={styles.datePickerKicker}>{t('insightDatePickerTitle')}</Text>
              <Text style={styles.datePickerValue}>{selectedDateLabel}</Text>
            </View>
            <Pressable
              onPress={() => moveDate(1)}
              disabled={selectedIsToday}
              accessibilityRole="button"
              accessibilityLabel={t('insightDateNext')}
              hitSlop={8}
              style={({ pressed }) => [
                styles.dateArrow,
                selectedIsToday && styles.dateArrowDisabled,
                pressed && !selectedIsToday && styles.dateArrowPressed,
              ]}>
              <FontAwesome name="chevron-right" size={13} color={selectedIsToday ? theme.textDim : theme.green} />
            </Pressable>
          </View>
          <View style={styles.dateActionRow}>
            <Pressable
              onPress={openCalendar}
              accessibilityRole="button"
              accessibilityLabel={t('insightOpenCalendar')}
              style={({ pressed }) => [styles.dateActionBtn, pressed && styles.dateActionBtnPressed]}>
              <FontAwesome name="calendar" size={12} color={theme.green} />
              <Text style={styles.dateActionText}>{t('insightOpenCalendar')}</Text>
            </Pressable>
            <Pressable
              onPress={goToday}
              disabled={selectedIsToday}
              accessibilityRole="button"
              accessibilityLabel={t('insightCalendarToday')}
              style={({ pressed }) => [
                styles.dateActionBtn,
                selectedIsToday && styles.dateActionBtnDisabled,
                pressed && !selectedIsToday && styles.dateActionBtnPressed,
              ]}>
              <FontAwesome name="dot-circle-o" size={12} color={selectedIsToday ? theme.textDim : theme.green} />
              <Text style={[styles.dateActionText, selectedIsToday && styles.dateActionTextDisabled]}>
                {t('insightCalendarToday')}
              </Text>
            </Pressable>
          </View>
          {watchlistSymbols.length > 0 ? (
            <Pressable
              onPress={() => setWatchlistOnly((prev) => !prev)}
              accessibilityRole="button"
              accessibilityState={{ selected: watchlistOnly }}
              accessibilityLabel={t('insightWatchlistOnly', { count: watchlistSymbols.length })}
              style={({ pressed }) => [
                styles.watchlistFilter,
                watchlistOnly && styles.watchlistFilterActive,
                pressed && styles.dateActionBtnPressed,
              ]}>
              <FontAwesome name={watchlistOnly ? 'star' : 'star-o'} size={12} color={theme.green} />
              <Text style={styles.watchlistFilterText}>
                {t('insightWatchlistOnly', { count: watchlistSymbols.length })}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.green} />
          <Text style={styles.muted}>{t('commonLoading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <InsightCard
              insight={item}
              theme={theme}
              scaleFont={scaleFont}
              compact={false}
              onOpenUrl={(url) => void WebBrowser.openBrowserAsync(url)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}
          ListEmptyComponent={
            <Text style={styles.muted}>{t(watchlistOnly ? 'insightListEmptyWatchlist' : 'insightListEmpty')}</Text>
          }
          ListFooterComponent={listFooter}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.35}
          removeClippedSubviews={Platform.OS === 'android'}
        />
      )}
      <Modal animationType="slide" transparent visible={calendarVisible} onRequestClose={() => setCalendarVisible(false)}>
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
              eventDates={new Set()}
              onSelectYmd={pickCalendarDate}
              onPrevMonth={() => shiftCalendarMonth(-1)}
              onNextMonth={() => shiftCalendarMonth(1)}
              monthPrevA11y={t('calendarMonthPrevA11y')}
              monthNextA11y={t('calendarMonthNextA11y')}
              todayYmd={todayYmd}
              maxYmd={todayYmd}
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
    safe: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    lead: {
      paddingHorizontal: 16,
      paddingTop: 10,
      fontSize: sf(13),
      fontWeight: '700',
      color: theme.textMuted,
      lineHeight: sf(19),
    },
    header: {
      paddingBottom: 12,
    },
    datePicker: {
      marginTop: 10,
      marginHorizontal: 16,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      borderRadius: 12,
      backgroundColor: theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}10` : theme.card,
    },
    datePickerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    dateArrow: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    dateArrowPressed: {
      opacity: 0.82,
    },
    dateArrowDisabled: {
      opacity: 0.42,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    datePickerCenter: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center',
      gap: 3,
    },
    datePickerKicker: {
      color: theme.textDim,
      fontSize: sf(11),
      fontWeight: '800',
    },
    datePickerValue: {
      color: theme.text,
      fontSize: sf(16),
      lineHeight: sf(21),
      fontWeight: '900',
    },
    dateActionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    dateActionBtn: {
      flex: 1,
      minHeight: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
    },
    dateActionBtnDisabled: {
      opacity: 0.48,
      borderColor: theme.border,
    },
    dateActionBtnPressed: {
      opacity: 0.86,
    },
    dateActionText: {
      color: theme.green,
      fontSize: sf(12),
      fontWeight: '900',
    },
    dateActionTextDisabled: {
      color: theme.textDim,
    },
    watchlistFilter: {
      minHeight: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.bgElevated,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingHorizontal: 10,
    },
    watchlistFilterActive: {
      backgroundColor: theme.greenDim,
    },
    watchlistFilterText: {
      color: theme.green,
      fontSize: sf(12),
      fontWeight: '900',
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 28,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      padding: 24,
    },
    muted: {
      fontSize: sf(13),
      color: theme.textMuted,
      textAlign: 'center',
    },
    err: {
      fontSize: sf(13),
      color: '#E0A0A0',
      textAlign: 'center',
      lineHeight: sf(19),
    },
    footerLoading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: 16,
    },
    footerMuted: {
      fontSize: sf(12),
      color: theme.textMuted,
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
    modalFoot: {
      paddingTop: 10,
    },
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
