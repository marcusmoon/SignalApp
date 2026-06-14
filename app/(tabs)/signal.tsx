import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { MarketBriefingBlock } from '@/components/signal/MarketBriefingBlock';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import type { AppTheme } from '@/constants/theme';
import { SEGMENT_TAB_ACTIVE_TEXT } from '@/constants/segmentTabBar';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import {
  QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import {
  loadQuotesChangeColorConvention,
  subscribeQuotesChangeColorConventionChanged,
} from '@/services/quotesChangeColorPreference';
import { markSignalFeedSeen } from '@/services/signalUnreadPreference';
import { addDays, toYmd } from '@/utils/date';

type BriefingMarketKey = 'kr' | 'us';

const MARKET_ORDER: readonly BriefingMarketKey[] = ['kr', 'us'];
const KR_SESSION_TABS = ['morning', 'lunch', 'evening'] as const;
const SESSION_ORDER: Record<BriefingMarketKey, readonly string[]> = {
  kr: ['morning', 'lunch', 'evening', 'close'],
  us: ['overnight', 'morning', 'close'],
};

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
      year: 'numeric',
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

export default function SignalScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const [todayYmd, setTodayYmd] = useState(() => toYmd(new Date()));
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromYmd(todayYmd));
  const [briefingMarket, setBriefingMarket] = useState<BriefingMarketKey>('kr');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [marketBriefings, setMarketBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [changeColorConvention, setChangeColorConvention] = useState<QuotesChangeColorConvention>(
    QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDateLabel = useMemo(() => formatSelectedDate(selectedYmd, locale), [locale, selectedYmd]);
  const selectedIsToday = selectedYmd >= todayYmd;

  const briefingMarketLabel = useCallback(
    (market: string) => (market === 'us' ? t('briefingMarketUs') : t('briefingMarketKr')),
    [t],
  );

  const briefingSessionLabel = useCallback(
    (session: string) => {
      if (session === 'morning') return t('briefingSessionMorning');
      if (session === 'lunch') return t('briefingSessionLunch');
      if (session === 'evening') return t('briefingSessionEvening');
      if (session === 'close') return t('briefingSessionClose');
      return t('briefingSessionOvernight');
    },
    [t],
  );

  const briefingSessionHint = useCallback(
    (session: string) => {
      if (session === 'morning') return t('briefingSessionHintMorning');
      if (session === 'lunch') return t('briefingSessionHintLunch');
      if (session === 'evening') return t('briefingSessionHintEvening');
      return null;
    },
    [t],
  );

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      setMarketBriefings([]);
      return;
    }
    setError(null);
    const rows = await fetchSignalMarketBriefings({ date: selectedYmd, limit: 30 }).catch(
      () => [] as SignalApiMarketBriefing[],
    );
    setMarketBriefings(
      [...rows].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))),
    );
  }, [selectedYmd, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } catch (e) {
      setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
    } finally {
      setRefreshing(false);
    }
  }, [load, t]);

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

  const reloadChangeColorConvention = useCallback(async () => {
    setChangeColorConvention(await loadQuotesChangeColorConvention());
  }, []);

  useEffect(() => {
    todayYmdRef.current = todayYmd;
  }, [todayYmd]);

  const refreshTodayYmd = useCallback(() => {
    const latest = toYmd(new Date());
    const previousToday = todayYmdRef.current;
    if (latest === previousToday) return;
    todayYmdRef.current = latest;
    setTodayYmd(latest);
    setSelectedYmd((current) => {
      const shouldMoveToLatest = current >= previousToday || current > latest;
      if (!shouldMoveToLatest) return current;
      setCalendarMonth(monthFromYmd(latest));
      return latest;
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshTodayYmd();
      void markSignalFeedSeen();
      void reloadChangeColorConvention();
    }, [refreshTodayYmd, reloadChangeColorConvention]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshTodayYmd();
    });
    return () => subscription.remove();
  }, [refreshTodayYmd]);

  useEffect(() => {
    return subscribeQuotesChangeColorConventionChanged(() => {
      void reloadChangeColorConvention();
    });
  }, [reloadChangeColorConvention]);

  const briefingMarketRows = useMemo(() => {
    const order = SESSION_ORDER[briefingMarket] ?? [];
    return marketBriefings
      .filter((row) => row.market === briefingMarket)
      .sort((a, b) => {
        const ai = order.indexOf(a.session);
        const bi = order.indexOf(b.session);
        if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
        return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
      });
  }, [briefingMarket, marketBriefings]);

  const briefingBySession = useMemo(() => {
    const map = new Map<string, SignalApiMarketBriefing>();
    for (const row of briefingMarketRows) {
      map.set(row.session, row);
    }
    return map;
  }, [briefingMarketRows]);

  const sessionTabOptions = useMemo(() => {
    if (briefingMarket === 'kr') {
      return [...KR_SESSION_TABS];
    }
    return SESSION_ORDER[briefingMarket].filter((session) => briefingBySession.has(session));
  }, [briefingBySession, briefingMarket]);

  const showSessionTabs = briefingMarket === 'kr' || sessionTabOptions.length > 1;

  useEffect(() => {
    setSelectedSession(null);
  }, [briefingMarket, selectedYmd]);

  const activeSession = useMemo(() => {
    if (selectedSession && briefingBySession.has(selectedSession)) {
      return selectedSession;
    }
    const available = sessionTabOptions.filter((session) => briefingBySession.has(session));
    if (available.length === 0) return null;
    return available[available.length - 1] ?? null;
  }, [briefingBySession, selectedSession, sessionTabOptions]);

  const activeBriefing = activeSession ? briefingBySession.get(activeSession) : undefined;

  const hasAnyBriefing = marketBriefings.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen options={{ title: t('screenSignal') }} />
      <SignalHeader compact onBrandPress={() => void onRefresh()} />

      <View style={styles.datePicker}>
        <Pressable
          onPress={() => moveDate(-1)}
          accessibilityRole="button"
          accessibilityLabel={t('insightDatePrevious')}
          hitSlop={8}
          style={({ pressed }) => [styles.dateArrow, pressed && styles.dateArrowPressed]}>
          <FontAwesome name="chevron-left" size={13} color={theme.green} />
        </Pressable>
        <Pressable
          onPress={openCalendar}
          accessibilityRole="button"
          accessibilityLabel={t('insightOpenCalendar')}
          style={({ pressed }) => [styles.datePickerCenter, pressed && styles.dateActionBtnPressed]}>
          <FontAwesome name="calendar" size={12} color={theme.green} />
          <Text style={styles.datePickerValue} numberOfLines={1}>
            {selectedDateLabel}
          </Text>
        </Pressable>
        {!selectedIsToday ? (
          <Pressable
            onPress={goToday}
            accessibilityRole="button"
            accessibilityLabel={t('insightCalendarToday')}
            style={({ pressed }) => [styles.dateTodayBtn, pressed && styles.dateActionBtnPressed]}>
            <Text style={styles.dateTodayText}>{t('insightCalendarToday')}</Text>
          </Pressable>
        ) : null}
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
          <FontAwesome
            name="chevron-right"
            size={13}
            color={selectedIsToday ? theme.textDim : theme.green}
          />
        </Pressable>
      </View>

      <View style={styles.marketTabs}>
        {MARKET_ORDER.map((market) => (
          <Pressable
            key={market}
            onPress={() => setBriefingMarket(market)}
            style={[styles.marketTab, briefingMarket === market && styles.marketTabActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: briefingMarket === market }}>
            <Text style={[styles.marketTabText, briefingMarket === market && styles.marketTabTextActive]}>
              {briefingMarketLabel(market)}
            </Text>
          </Pressable>
        ))}
      </View>

      {!loading && showSessionTabs ? (
        <View style={styles.sessionTabsWrap}>
          <View style={styles.sessionTabs}>
            {sessionTabOptions.map((session) => {
              const hasBriefing = briefingBySession.has(session);
              const isActive = activeSession === session;
              return (
                <Pressable
                  key={session}
                  onPress={() => setSelectedSession(session)}
                  disabled={!hasBriefing}
                  style={[
                    styles.sessionTab,
                    isActive && styles.sessionTabActive,
                    !hasBriefing && styles.sessionTabDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: !hasBriefing }}>
                  <Text
                    style={[
                      styles.sessionTabText,
                      isActive && styles.sessionTabTextActive,
                      !hasBriefing && styles.sessionTabTextDisabled,
                    ]}>
                    {briefingSessionLabel(session)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {briefingMarket === 'kr' && activeSession ? (
            <Text style={styles.sessionHint}>{briefingSessionHint(activeSession)}</Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <OtaUpdateBanner />

          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          {!error ? (
            activeBriefing ? (
              <MarketBriefingBlock
                briefing={activeBriefing}
                theme={theme}
                scaleFont={scaleFont}
                changeColorConvention={changeColorConvention}
              />
            ) : briefingMarketRows.length > 0 && activeSession ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{t('briefingSessionEmptyTitle')}</Text>
                <Text style={styles.emptyBody}>{t('briefingSessionEmptyBody')}</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {hasAnyBriefing ? t('briefingHubMarketEmptyTitle') : t('briefingHubEmptyTitle')}
                </Text>
                <Text style={styles.emptyBody}>
                  {hasAnyBriefing ? t('briefingHubMarketEmptyBody') : t('briefingHubEmptyBody')}
                </Text>
              </View>
            )
          ) : null}
        </ScrollView>
      )}

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
  const digestBg =
    theme.green.startsWith('#') && theme.green.length === 7 ? `${theme.green}10` : theme.bgElevated;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 4 },
    datePicker: {
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 8,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      borderRadius: 13,
      backgroundColor: digestBg,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dateArrow: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    dateArrowPressed: { opacity: 0.82 },
    dateArrowDisabled: {
      opacity: 0.42,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
    },
    datePickerCenter: {
      flex: 1,
      minWidth: 0,
      height: 34,
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
    datePickerValue: {
      color: theme.text,
      fontSize: sf(14),
      lineHeight: sf(18),
      fontWeight: '900',
      textAlign: 'center',
      flexShrink: 1,
    },
    dateTodayBtn: {
      height: 34,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
    },
    dateTodayText: { color: theme.green, fontSize: sf(12), fontWeight: '900' },
    dateActionBtnPressed: { opacity: 0.86 },
    marketTabs: {
      flexDirection: 'row',
      gap: 10,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    marketTab: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
    },
    marketTabActive: {
      backgroundColor: theme.green,
      borderColor: theme.green,
    },
    marketTabText: {
      fontSize: sf(14),
      fontWeight: '900',
      color: theme.textDim,
    },
    marketTabTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    sessionTabsWrap: {
      marginHorizontal: 16,
      marginBottom: 12,
      gap: 6,
    },
    sessionTabs: {
      flexDirection: 'row',
      gap: 8,
    },
    sessionTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
    },
    sessionTabActive: {
      backgroundColor: theme.greenDim,
    },
    sessionTabDisabled: {
      opacity: 0.38,
    },
    sessionTabText: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.textDim,
    },
    sessionTabTextActive: {
      color: theme.green,
    },
    sessionTabTextDisabled: {
      color: theme.textDim,
    },
    sessionHint: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.textMuted,
      paddingHorizontal: 2,
    },
    emptyCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 22,
      paddingHorizontal: 18,
      marginBottom: 16,
    },
    emptyTitle: {
      fontSize: sf(18),
      lineHeight: sf(25),
      fontWeight: '900',
      color: theme.text,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: sf(14),
      lineHeight: sf(21),
      fontWeight: '600',
      color: theme.textDim,
    },
    errBox: {
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
    },
    errText: { color: theme.text, fontSize: sf(14), lineHeight: sf(20) },
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
