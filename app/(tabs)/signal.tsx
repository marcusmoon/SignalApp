import { useFocusEffect } from "expo-router/react-navigation";
import { Stack } from 'expo-router';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
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
import { FeedUpdateBanner } from '@/components/signal/FeedUpdateBanner';
import { FloatingGlassFab } from '@/components/signal/FloatingGlassFab';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { MarketBriefingBlock } from '@/components/signal/MarketBriefingBlock';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_WIDE_CONTENT_MAX_WIDTH } from '@/constants/responsiveLayout';
import { tabBarBottomInset } from '@/constants/tabBar';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
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
import { markSignalFeedSeen, fetchLatestSignalBriefingId } from '@/services/signalUnreadPreference';
import { useTabPressCycleSegment } from '@/hooks';
import { addDays, toYmd } from '@/utils/date';

type FlatTabKey = 'us-overnight' | 'kr-morning' | 'kr-lunch' | 'kr-evening';

const FLAT_TABS: ReadonlyArray<{ key: FlatTabKey; market: 'us' | 'kr'; session: string }> = [
  { key: 'us-overnight', market: 'us', session: 'overnight' },
  { key: 'kr-morning',   market: 'kr', session: 'morning' },
  { key: 'kr-lunch',     market: 'kr', session: 'lunch' },
  { key: 'kr-evening',   market: 'kr', session: 'evening' },
];

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
  const tabBarHeight = useBottomTabBarHeight();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const { setSubTabs, clearSubTabs } = useSidebarSubTabs();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const [todayYmd, setTodayYmd] = useState(() => toYmd(new Date()));
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(todayYmd);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromYmd(todayYmd));
  const [selectedTabKey, setSelectedTabKey] = useState<FlatTabKey | null>(null);
  const [marketBriefings, setMarketBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const [changeColorConvention, setChangeColorConvention] = useState<QuotesChangeColorConvention>(
    QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [newContentAvailable, setNewContentAvailable] = useState(false);
  const latestSeenIdRef = useRef<string | null>(null);

  const selectedDateLabel = useMemo(() => formatSelectedDate(selectedYmd, locale), [locale, selectedYmd]);
  const selectedIsToday = selectedYmd >= todayYmd;

  const flatTabLabel = useCallback(
    (key: FlatTabKey) => {
      if (key === 'us-overnight') return t('briefingSessionOvernight');
      if (key === 'kr-morning')   return t('briefingSessionMorning');
      if (key === 'kr-lunch')     return t('briefingSessionLunch');
      return t('briefingSessionEvening');
    },
    [t],
  );

  const load = useCallback(async (): Promise<SignalApiMarketBriefing[]> => {
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      setMarketBriefings([]);
      return [];
    }
    setError(null);
    const rows = await fetchSignalMarketBriefings({ date: selectedYmd, limit: 30 }).catch(
      () => [] as SignalApiMarketBriefing[],
    );
    const sorted = [...rows].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    setMarketBriefings(sorted);
    if (selectedYmd >= todayYmdRef.current && sorted[0]?.id) {
      latestSeenIdRef.current = sorted[0].id;
    }
    return sorted;
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
    const prevIds = new Set(marketBriefings.map((row) => row.id));
    setRefreshing(true);
    setRefreshNotice(null);
    setNewContentAvailable(false);
    try {
      const rows = await load();
      const newCount = rows.filter((row) => !prevIds.has(row.id)).length;
      if (newCount > 0) {
        setRefreshNotice(t('briefingRefreshNotice', { count: String(newCount) }));
      }
    } catch (e) {
      setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
    } finally {
      setRefreshing(false);
    }
  }, [load, marketBriefings, t]);

  useEffect(() => {
    if (!refreshNotice) return;
    const timeout = setTimeout(() => setRefreshNotice(null), 4500);
    return () => clearTimeout(timeout);
  }, [refreshNotice]);

  /** 오늘 날짜 화면에서만 백그라운드 폴링으로 새 브리핑 배너 표시 */
  useEffect(() => {
    if (selectedYmd < todayYmd) {
      setNewContentAvailable(false);
      return;
    }
    if (!hasSignalApi()) return;
    const POLL_MS = 3 * 60 * 1000;
    const poll = async () => {
      try {
        const latestId = await fetchLatestSignalBriefingId();
        if (!latestId) return;
        if (latestSeenIdRef.current === null) {
          latestSeenIdRef.current = latestId;
          return;
        }
        if (latestId !== latestSeenIdRef.current) {
          setNewContentAvailable(true);
        }
      } catch {
        /* ignore polling errors */
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [selectedYmd, todayYmd]);

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

  const briefingByTabKey = useMemo(() => {
    const map = new Map<FlatTabKey, SignalApiMarketBriefing>();
    for (const tab of FLAT_TABS) {
      const match = marketBriefings.find(
        (row) => row.market === tab.market && row.session === tab.session,
      );
      if (match) map.set(tab.key, match);
    }
    return map;
  }, [marketBriefings]);

  useEffect(() => {
    setSelectedTabKey(null);
  }, [selectedYmd]);

  const activeTabKey = useMemo((): FlatTabKey | null => {
    if (selectedTabKey && briefingByTabKey.has(selectedTabKey)) return selectedTabKey;
    // Auto-select: last tab (most recent session) that has data
    for (let i = FLAT_TABS.length - 1; i >= 0; i--) {
      if (briefingByTabKey.has(FLAT_TABS[i].key)) return FLAT_TABS[i].key;
    }
    return null;
  }, [briefingByTabKey, selectedTabKey]);

  const activeBriefing = activeTabKey ? briefingByTabKey.get(activeTabKey) : undefined;
  const hasAnyBriefing = marketBriefings.length > 0;
  const fabStackBottom = tabBarHeight + tabBarBottomInset(insets.bottom) + 8;

  const availableSessionTabKeys = useMemo(
    () => FLAT_TABS.filter((tab) => briefingByTabKey.has(tab.key)).map((tab) => tab.key),
    [briefingByTabKey],
  );

  const onPickSessionTab = useCallback((key: FlatTabKey) => {
    if (!briefingByTabKey.has(key)) return;
    setSelectedTabKey(key);
  }, [briefingByTabKey]);

  useTabPressCycleSegment(activeTabKey, availableSessionTabKeys, onPickSessionTab);

  // iPad 사이드바 서브탭 등록
  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane || !ipadNav.isAvailable) return;
      const pending = ipadNav.takePendingSignalSession();
      if (pending) {
        setSelectedYmd(todayYmdRef.current);
        setSelectedTabKey(pending);
      }
    }, [ipadNav, useTwoPane]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      setSubTabs(
        FLAT_TABS.map((tab) => ({
          key: tab.key,
          label: flatTabLabel(tab.key),
          active: activeTabKey === tab.key,
          onPress: () => onPickSessionTab(tab.key),
        })),
      );
      return () => clearSubTabs();
    }, [useTwoPane, activeTabKey, flatTabLabel, onPickSessionTab, setSubTabs, clearSubTabs]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      <Stack.Screen options={{ title: t('screenSignal') }} />
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}

      {newContentAvailable && !refreshing && selectedYmd >= todayYmd ? (
        <View style={styles.updateBannerWrap}>
          <FeedUpdateBanner
            variant="prompt"
            message={t('feedNewContentAvailable')}
            onPress={() => void onRefresh()}
          />
        </View>
      ) : null}
      {refreshNotice ? (
        <View style={styles.updateBannerWrap}>
          <FeedUpdateBanner variant="notice" message={refreshNotice} />
        </View>
      ) : null}

      <SignalDateNavigator
        label={selectedDateLabel}
        previousA11y={t('insightDatePrevious')}
        nextA11y={t('insightDateNext')}
        labelA11y={t('insightOpenCalendar')}
        todayLabel={t('insightCalendarToday')}
        onPrevious={() => moveDate(-1)}
        onNext={() => moveDate(1)}
        onPressLabel={openCalendar}
        onToday={goToday}
        showToday={!selectedIsToday}
        nextDisabled={selectedIsToday}
        style={[styles.dateNavigator, useTwoPane && styles.dateNavigatorWide]}
      />

      {!loading && !useTwoPane ? (
        <View style={styles.sessionTabsWrap}>
          <View style={styles.sessionTabs}>
            {FLAT_TABS.map((tab) => {
              const hasBriefing = briefingByTabKey.has(tab.key);
              const isActive = activeTabKey === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onPickSessionTab(tab.key)}
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
                    {flatTabLabel(tab.key)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, useTwoPane && styles.contentWide, { paddingBottom: 24 + insets.bottom }]}
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
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>
                  {hasAnyBriefing ? t('briefingSessionEmptyTitle') : t('briefingHubEmptyTitle')}
                </Text>
                <Text style={styles.emptyBody}>
                  {hasAnyBriefing ? t('briefingSessionEmptyBody') : t('briefingHubEmptyBody')}
                </Text>
              </View>
            )
          ) : null}
        </ScrollView>
      )}

      {hasSignalApi() && !useTwoPane ? (
        <FloatingGlassFab
          bottom={fabStackBottom}
          onPress={() => void onRefresh()}
          iconName="sync"
          accessibilityLabel={t('fabRefreshA11y')}
          disabled={refreshing || loading}
        />
      ) : null}

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
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    updateBannerWrap: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    contentWide: {
      maxWidth: APP_WIDE_CONTENT_MAX_WIDTH,
      alignSelf: 'stretch',
      paddingTop: 12,
    },
    dateNavigator: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH - 32,
      alignSelf: 'center',
      marginHorizontal: 16,
      marginBottom: 10,
    },
    dateNavigatorWide: {
      maxWidth: APP_CONTENT_MAX_WIDTH,
      marginTop: 12,
    },
    dateActionBtnPressed: { opacity: 0.86 },
    sessionTabsWrap: {
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH - 32,
      alignSelf: 'center',
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
