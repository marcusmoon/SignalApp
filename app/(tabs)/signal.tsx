import { useFocusEffect, useIsFocused } from "expo-router/react-navigation";
import { Stack, useLocalSearchParams } from 'expo-router';
import { useBottomTabBarHeight } from "expo-router/js-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { WebWheelScrollView } from '@/components/layout/WebWheelScrollView';
import { FeedNewContentChip } from '@/components/signal/FeedNewContentChip';
import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { MarketBriefingBlock } from '@/components/signal/MarketBriefingBlock';
import { SignalDateNavigator } from '@/components/signal/SignalDateNavigator';
import { SignalHeader } from '@/components/signal/SignalHeader';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import { APP_CONTENT_MAX_WIDTH, APP_CONTENT_SIDE_PADDING, APP_WIDE_CONTENT_MAX_WIDTH, wideContentFill } from '@/constants/responsiveLayout';
import {
  getSegmentTabBarStyles,
  SCREEN_LIST_CONTENT_PADDING_TOP,
  SCREEN_WIDE_CONTENT_PADDING_TOP,
} from '@/constants/segmentTabBar';
import { getScreenFixedHeaderStyles } from '@/constants/screenFixedHeader';
import {
  SCREEN_WIDE_SCROLL_BOTTOM_BASE,
  tabScreenScrollBottomPadding,
} from '@/constants/screenLayout';
import type { AppTheme } from '@/constants/theme';
import { webFlexFill, webScrollViewportStyle, webShellBackground } from '@/constants/webLayout';
import { useLocale } from '@/contexts/LocaleContext';
import { useRegisterWebHeaderRefresh } from '@/contexts/WebHeaderRefreshContext';
import { useIpadSidebarNav } from '@/contexts/IpadSidebarNavContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { useSidebarSubTabs } from '@/contexts/SidebarSubTabsContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  type QuotesChangeColorConvention,
} from '@/domain/quotes/changeColorConvention';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import { signalCacheMode } from '@/integrations/signal-api/cacheMode';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import { hasSignalApi } from '@/services/env';
import {
  loadQuotesChangeColorConvention,
  subscribeQuotesChangeColorConventionChanged,
} from '@/services/quotesChangeColorPreference';
import { markSignalFeedSeen } from '@/services/signalUnreadPreference';
import { useScrollToTopOnChange, useTabPressCycleSegment } from '@/hooks';
import { addDays, toYmd, utcRangeForLocalYmd } from '@/utils/date';
import { firstRouteParam } from '@/utils/routeSearchParams';
import { useSafeSetRouteParams } from '@/utils/safeRouteParams';

type FlatTabKey = 'us-overnight' | 'kr-morning' | 'kr-lunch' | 'kr-close';

const FLAT_TABS: ReadonlyArray<{ key: FlatTabKey; market: 'us' | 'kr'; session: string }> = [
  { key: 'us-overnight', market: 'us', session: 'overnight' },
  { key: 'kr-morning',   market: 'kr', session: 'morning' },
  { key: 'kr-lunch',     market: 'kr', session: 'lunch' },
  { key: 'kr-close',     market: 'kr', session: 'close' },
];

const FLAT_TAB_KEYS = new Set<FlatTabKey>(FLAT_TABS.map((tab) => tab.key));

function isFlatTabKey(value: string): value is FlatTabKey {
  return FLAT_TAB_KEYS.has(value as FlatTabKey);
}

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
  const setRouteParams = useSafeSetRouteParams();
  const routeParams = useLocalSearchParams<{ session?: string | string[]; date?: string | string[] }>();
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const { useTwoPane } = useResponsiveLayout();
  const ipadNav = useIpadSidebarNav();
  const { setSubTabs, setActiveSubTabKey, clearSubTabs } = useSidebarSubTabs();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const initialTodayYmd = toYmd(new Date());
  const routeSessionInit = firstRouteParam(routeParams.session);
  const routeDateInit = firstRouteParam(routeParams.date);

  const [todayYmd, setTodayYmd] = useState(initialTodayYmd);
  const todayYmdRef = useRef(todayYmd);
  const [selectedYmd, setSelectedYmd] = useState(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(routeDateInit)) {
      return routeDateInit > initialTodayYmd ? initialTodayYmd : routeDateInit;
    }
    return initialTodayYmd;
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => monthFromYmd(
    /^\d{4}-\d{2}-\d{2}$/.test(routeDateInit) ? (routeDateInit > initialTodayYmd ? initialTodayYmd : routeDateInit) : initialTodayYmd,
  ));
  const [selectedTabKey, setSelectedTabKey] = useState<FlatTabKey | null>(() =>
    isFlatTabKey(routeSessionInit) ? routeSessionInit : null,
  );
  const [marketBriefings, setMarketBriefings] = useState<SignalApiMarketBriefing[]>([]);
  const marketBriefingsRef = useRef(marketBriefings);
  marketBriefingsRef.current = marketBriefings;
  const [changeColorConvention, setChangeColorConvention] = useState<QuotesChangeColorConvention>(
    QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT,
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newContentTabs, setNewContentTabs] = useState(() => new Set<FlatTabKey>());
  const latestSeenIdByTabRef = useRef<Partial<Record<FlatTabKey, string>>>({});

  const selectedDateLabel = useMemo(() => formatSelectedDate(selectedYmd, locale), [locale, selectedYmd]);
  const selectedIsToday = selectedYmd >= todayYmd;

  const markTabHasNewContent = useCallback((key: FlatTabKey) => {
    setNewContentTabs((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const clearTabNewContent = useCallback((key: FlatTabKey) => {
    setNewContentTabs((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const syncTabLatestSeen = useCallback(
    (key: FlatTabKey, latestId: string | null | undefined) => {
      const id = latestId?.trim();
      if (!id) return;
      latestSeenIdByTabRef.current[key] = id;
      clearTabNewContent(key);
    },
    [clearTabNewContent],
  );

  const syncBriefingsLatestSeen = useCallback(
    (rows: SignalApiMarketBriefing[]) => {
      for (const tab of FLAT_TABS) {
        const match = rows.find((row) => row.market === tab.market && row.session === tab.session);
        syncTabLatestSeen(tab.key, match?.id);
      }
    },
    [syncTabLatestSeen],
  );

  const flatTabLabel = useCallback(
    (key: FlatTabKey) => {
      switch (key) {
        case 'us-overnight':
          return t('briefingSessionOvernight');
        case 'kr-morning':
          return t('briefingSessionMorning');
        case 'kr-lunch':
          return t('briefingSessionLunch');
        case 'kr-close':
          return t('briefingSessionClose');
      }
    },
    [t],
  );

  const load = useCallback(async (forceRefresh?: boolean, syncScope: 'all' | FlatTabKey = 'all'): Promise<SignalApiMarketBriefing[]> => {
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      setMarketBriefings([]);
      return [];
    }
    setError(null);
    const rows = await fetchSignalMarketBriefings(
      { ...utcRangeForLocalYmd(selectedYmd), limit: 30 },
      { cacheMode: signalCacheMode(forceRefresh) },
    ).catch(() => [] as SignalApiMarketBriefing[]);
    const sorted = [...rows].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
    setMarketBriefings(sorted);
    if (selectedYmd >= todayYmdRef.current) {
      if (syncScope === 'all') {
        syncBriefingsLatestSeen(sorted);
      } else {
        const tab = FLAT_TABS.find((item) => item.key === syncScope);
        const match = tab
          ? sorted.find((row) => row.market === tab.market && row.session === tab.session)
          : undefined;
        syncTabLatestSeen(syncScope, match?.id);
      }
    }
    return sorted;
  }, [selectedYmd, syncBriefingsLatestSeen, syncTabLatestSeen, t]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const hadBriefings = marketBriefingsRef.current.length > 0;
      if (!hadBriefings) setLoading(true);
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

  /** 오늘 날짜 화면에서만 백그라운드 폴링으로 세션별 새 브리핑 chip 표시 */
  useEffect(() => {
    if (selectedYmd < todayYmd) return;
    if (!hasSignalApi()) return;
    const POLL_MS = 3 * 60 * 1000;
    const poll = async () => {
      try {
        const rows = await fetchSignalMarketBriefings(
          { ...utcRangeForLocalYmd(todayYmdRef.current), limit: 30 },
          { cacheMode: 'bypass' },
        );
        for (const tab of FLAT_TABS) {
          const match = rows.find((row) => row.market === tab.market && row.session === tab.session);
          const latestId = match?.id ?? null;
          if (!latestId) continue;
          const seen = latestSeenIdByTabRef.current[tab.key];
          if (!seen) continue;
          if (latestId !== seen) markTabHasNewContent(tab.key);
        }
      } catch {
        /* ignore polling errors */
      }
    };
    const id = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(id);
  }, [markTabHasNewContent, selectedYmd, todayYmd]);

  useEffect(() => {
    if (selectedYmd < todayYmd) {
      setNewContentTabs(new Set());
    }
  }, [selectedYmd, todayYmd]);

  const syncDateRouteParam = useCallback(
    (ymd: string) => {
      setRouteParams({ date: ymd === todayYmdRef.current ? undefined : ymd });
    },
    [setRouteParams],
  );

  const moveDate = useCallback(
    (days: number) => {
      setSelectedYmd((prev) => {
        const next = shiftYmd(prev, days);
        const clamped = next > todayYmd ? todayYmd : next;
        syncDateRouteParam(clamped);
        return clamped;
      });
    },
    [syncDateRouteParam, todayYmd],
  );

  const openCalendar = useCallback(() => {
    setCalendarMonth(monthFromYmd(selectedYmd));
    setCalendarVisible(true);
  }, [selectedYmd]);

  const pickCalendarDate = useCallback(
    (ymd: string) => {
      const clamped = ymd > todayYmd ? todayYmd : ymd;
      setSelectedYmd(clamped);
      syncDateRouteParam(clamped);
      setCalendarVisible(false);
    },
    [syncDateRouteParam, todayYmd],
  );

  const shiftCalendarMonth = useCallback((delta: number) => {
    setCalendarMonth((prev) => {
      const date = new Date(prev.year, prev.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }, []);

  const goToday = useCallback(() => {
    setSelectedYmd(todayYmd);
    syncDateRouteParam(todayYmd);
    setCalendarMonth(monthFromYmd(todayYmd));
  }, [syncDateRouteParam, todayYmd]);

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
  const newContentAvailable = activeTabKey ? newContentTabs.has(activeTabKey) : false;
  const { ref: scrollRef } = useScrollToTopOnChange([activeTabKey, selectedYmd], {
    resyncDeps: [activeBriefing?.id, marketBriefings.length],
  });
  const scrollResetKey = `${activeTabKey ?? 'none'}:${selectedYmd}`;
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTabKey) clearTabNewContent(activeTabKey);
    try {
      await load(true, activeTabKey ?? 'all');
    } catch (e) {
      setError(formatSignalApiError(e, t, 'briefingErrorLoad'));
    } finally {
      setRefreshing(false);
    }
  }, [activeTabKey, clearTabNewContent, load, t]);
  useRegisterWebHeaderRefresh(() => void onRefresh());
  const hasAnyBriefing = marketBriefings.length > 0;
  const scrollBottomPadding = useTwoPane
    ? SCREEN_WIDE_SCROLL_BOTTOM_BASE
    : tabScreenScrollBottomPadding(tabBarHeight, insets.bottom);

  const availableSessionTabKeys = useMemo(
    () => FLAT_TABS.filter((tab) => briefingByTabKey.has(tab.key)).map((tab) => tab.key),
    [briefingByTabKey],
  );

  const onPickSessionTab = useCallback((key: FlatTabKey) => {
    if (!briefingByTabKey.has(key)) return;
    setSelectedTabKey(key);
    if (useTwoPane) setActiveSubTabKey(key);
    setRouteParams({ session: key });
  }, [briefingByTabKey, setActiveSubTabKey, setRouteParams, useTwoPane]);

  useTabPressCycleSegment(activeTabKey, availableSessionTabKeys, onPickSessionTab);

  const registerSignalSubTabs = useCallback(() => {
    if (!useTwoPane) return;
    if (activeTabKey) setActiveSubTabKey(activeTabKey);
    setSubTabs(
      FLAT_TABS.map((tab) => ({
        key: tab.key,
        label: flatTabLabel(tab.key),
        onPress: () => onPickSessionTab(tab.key),
      })),
    );
  }, [activeTabKey, flatTabLabel, onPickSessionTab, setActiveSubTabKey, setSubTabs, useTwoPane]);

  useEffect(() => {
    registerSignalSubTabs();
  }, [registerSignalSubTabs]);

  useFocusEffect(
    useCallback(() => {
      const pendingSession =
        useTwoPane && ipadNav.isAvailable ? ipadNav.takePendingSignalSession() : null;
      const pendingDate =
        useTwoPane && ipadNav.isAvailable ? ipadNav.takePendingSignalDate() : null;

      if (pendingSession && isFlatTabKey(pendingSession)) {
        setSelectedTabKey(pendingSession);
        setRouteParams({ session: pendingSession });
      }
      if (pendingDate && /^\d{4}-\d{2}-\d{2}$/.test(pendingDate)) {
        const clamped = pendingDate > todayYmdRef.current ? todayYmdRef.current : pendingDate;
        setSelectedYmd(clamped);
        setCalendarMonth(monthFromYmd(clamped));
        setRouteParams({ date: clamped === todayYmdRef.current ? undefined : clamped });
      } else if (pendingSession) {
        setSelectedYmd(todayYmdRef.current);
      }
    }, [ipadNav, setRouteParams, useTwoPane]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!useTwoPane) return;
      registerSignalSubTabs();
      return () => clearSubTabs();
    }, [clearSubTabs, registerSignalSubTabs, useTwoPane]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={useTwoPane ? [] : ['top']}>
      <Stack.Screen options={{ title: t('screenSignal') }} />
      {!useTwoPane ? <SignalHeader compact onBrandPress={() => void onRefresh()} /> : null}
      {isFocused ? <OtaUpdateBanner /> : null}

      <View style={[styles.pageColumn, useTwoPane && styles.pageColumnWide]}>
      <View style={[styles.topFixed, useTwoPane && styles.topFixedWide]}>
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
          style={styles.dateNavigator}
        />

      {!loading && !useTwoPane ? (
        <View style={styles.segment}>
            {FLAT_TABS.map((tab) => {
              const hasBriefing = briefingByTabKey.has(tab.key);
              const isActive = activeTabKey === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => onPickSessionTab(tab.key)}
                  disabled={!hasBriefing}
                  style={[
                    styles.segBtn,
                    isActive && styles.segBtnActive,
                    !hasBriefing && styles.segBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive, disabled: !hasBriefing }}>
                  <Text
                    style={[
                      styles.segText,
                      isActive && styles.segTextActive,
                      !hasBriefing && styles.segTextDisabled,
                    ]}>
                    {flatTabLabel(tab.key)}
                  </Text>
                </Pressable>
              );
            })}
        </View>
      ) : null}
      </View>

      {isFocused && selectedYmd >= todayYmd ? (
        <FeedNewContentChip
          visible={newContentAvailable}
          refreshing={refreshing}
          message={t('feedNewContentAvailable')}
          onPress={() => void onRefresh()}
        />
      ) : null}

      {error ? (
        <View style={styles.errBox}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      {loading && marketBriefings.length === 0 ? (
        <View style={styles.center}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <WebWheelScrollView
          ref={scrollRef as never}
          scrollResetKey={scrollResetKey}
          contentRevision={[activeBriefing?.id, marketBriefings.length]}
          style={styles.scroll}
          contentContainerStyle={[styles.content, useTwoPane && styles.contentWide, { paddingBottom: scrollBottomPadding }]}
          refreshControl={<ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
        </WebWheelScrollView>
      )}
      </View>

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
  const segmentTab = getSegmentTabBarStyles(theme, sf);
  const fixedHeader = getScreenFixedHeaderStyles(theme);
  return StyleSheet.create({
    safe: { ...webFlexFill, backgroundColor: webShellBackground(theme.bg) },
    pageColumn: {
      ...webFlexFill,
      width: '100%',
      maxWidth: APP_CONTENT_MAX_WIDTH,
      alignSelf: 'center',
    },
    pageColumnWide: {
      ...wideContentFill,
    },
    topFixed: fixedHeader.strip,
    topFixedWide: fixedHeader.stripWide,
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listLoadingRow: { alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
    scroll: { ...webScrollViewportStyle },
    content: {
      width: '100%',
      paddingHorizontal: 16,
      paddingTop: SCREEN_LIST_CONTENT_PADDING_TOP,
    },
    contentWide: {
      paddingTop: SCREEN_WIDE_CONTENT_PADDING_TOP,
    },
    dateNavigator: {
      width: '100%',
    },
    dateActionBtnPressed: { opacity: 0.86 },
    segment: segmentTab.segment,
    segBtn: segmentTab.segBtn,
    segBtnActive: segmentTab.segBtnActive,
    segBtnDisabled: segmentTab.segBtnDisabled,
    segText: segmentTab.segText,
    segTextActive: segmentTab.segTextActive,
    segTextDisabled: segmentTab.segTextDisabled,
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
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 12,
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
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
