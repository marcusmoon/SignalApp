import { type ElementRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeMethods,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { InvestMonthCalendar } from '@/components/signal/InvestMonthCalendar';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalBannerAd } from '@/components/signal/SignalBannerAd';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCalendarEventsMergedCached } from '@/services/calendarCache';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
import { loadCalendarConcallScope } from '@/services/calendarConcallScopePreference';
import { hasFinnhub } from '@/services/env';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { toYmd } from '@/utils/date';
import type { CalendarEvent } from '@/types/signal';

type EventSection = { title: string; data: CalendarEvent[] };

function ymdInMonth(ymd: string, year: number, month0: number): boolean {
  const prefix = `${year}-${String(month0 + 1).padStart(2, '0')}-`;
  return ymd.startsWith(prefix);
}

/** ScrollView 런타임 API — Fabric에서 measureLayout 상대 기준으로 inner content ref 필요 (TS에는 미기재) */
function getScrollInnerContentRef(scroll: ScrollView): NativeMethods | null {
  const s = scroll as ScrollView & { getInnerViewRef?: () => NativeMethods | null };
  return s.getInnerViewRef?.() ?? null;
}

/** 스크롤할 섹션 날짜(YYYY-MM-DD). 일정이 없는 날이면 가장 가까운 이전 일정일 */
function findScrollTargetYmd(sections: { title: string }[], ymd: string): string | null {
  if (sections.length === 0) return null;
  const exact = sections.find((s) => s.title === ymd);
  if (exact) return exact.title;
  const after = sections.findIndex((s) => s.title > ymd);
  if (after === -1) return sections[sections.length - 1].title;
  if (after === 0) return sections[0].title;
  return sections[after - 1].title;
}

export default function CalendarScreen() {
  const { theme } = useSignalTheme();
  const { t, locale } = useLocale();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const scrollRef = useRef<ScrollView>(null);
  /** 날짜 블록 View — measureLayout로 inner content 기준 Y를 구해 scrollTo에 사용 */
  const dayBlockRefs = useRef<Record<string, ElementRef<typeof View> | null>>({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);

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
      if (!hasFinnhub()) {
        setEvents([]);
        setError('EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다.');
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
    [visibleMonth],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '캘린더를 불러오지 못했습니다.');
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
      setError(e instanceof Error ? e.message : '새로고침 실패');
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const sections = useMemo((): EventSection[] => {
    const byDay = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const k = e.date;
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k)!.push(e);
    }
    const keys = [...byDay.keys()].sort();
    return keys.map((ymd) => ({ title: ymd, data: byDay.get(ymd)! }));
  }, [events]);

  const sectionsKey = useMemo(() => sections.map((s) => s.title).join('|'), [sections]);

  const prevSectionsKeyRef = useRef(sectionsKey);
  if (prevSectionsKeyRef.current !== sectionsKey) {
    prevSectionsKeyRef.current = sectionsKey;
    dayBlockRefs.current = {};
  }

  const eventDates = useMemo(() => new Set(events.map((e) => e.date)), [events]);

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

  const scrollToSelectedBlock = useCallback(() => {
    const targetYmd = findScrollTargetYmd(sections, selectedYmd);
    if (!targetYmd) return;

    const tryScroll = (attempt: number) => {
      const scroll = scrollRef.current;
      const block = dayBlockRefs.current[targetYmd];
      if (!scroll || !block) {
        if (attempt < 24) setTimeout(() => tryScroll(attempt + 1), 50);
        return;
      }
      // Fabric: measureLayout은 node handle(number)가 아니라 native ref(HostInstance)만 허용
      const inner = getScrollInnerContentRef(scroll);
      if (inner == null) {
        if (attempt < 24) setTimeout(() => tryScroll(attempt + 1), 50);
        return;
      }
      block.measureLayout(
        inner,
        (_x, y) => {
          scroll.scrollTo({ y: Math.max(0, y - 10), animated: true });
        },
        () => {
          if (attempt < 24) setTimeout(() => tryScroll(attempt + 1), 80);
        },
      );
    };

    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => tryScroll(0));
      });
    }, 60);
  }, [sections, selectedYmd]);

  useEffect(() => {
    if (loading || sections.length === 0) return;
    scrollToSelectedBlock();
  }, [selectedYmd, loading, sectionsKey, scrollToSelectedBlock]);

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

  if (!hasFinnhub()) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        {isFocused ? <OtaUpdateBanner /> : null}
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: 28 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.hint}>{t('calendarScreenHint')}</Text>
          <View style={styles.errBox}>
            <Text style={styles.errText}>EXPO_PUBLIC_FINNHUB_TOKEN 이 필요합니다.</Text>
          </View>
          <SignalBannerAd />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {isFocused ? <OtaUpdateBanner /> : null}
      <View style={styles.fixedTop}>
        <Text style={styles.hint}>{t('calendarScreenHint')}</Text>
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
      <ScrollView
        ref={scrollRef}
        style={styles.listScroll}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 28 + insets.bottom },
          sections.length === 0 && !loading ? styles.listContentEmpty : null,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />}>
        <Text style={styles.monthHeading}>{t('calendarScreenMonthHeading')}</Text>

        {loading ? (
          <Text style={styles.loading}>{t('commonLoading')}</Text>
        ) : null}

        {!loading && sections.length === 0 && !error ? (
          <Text style={styles.empty}>{t('calendarScreenEmptyMonth')}</Text>
        ) : null}

        {sections.map((section) => (
          <View
            key={section.title}
            collapsable={false}
            ref={(el) => {
              if (el) dayBlockRefs.current[section.title] = el;
              else delete dayBlockRefs.current[section.title];
            }}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderText}>{formatDayHeader(section.title)}</Text>
            </View>
            {section.data.map((ev) => (
              <View key={ev.id} style={styles.card}>
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
                            borderColor: theme.accentOrange + '88',
                            backgroundColor: theme.accentOrange + '22',
                          },
                        ]}>
                        <Text
                          style={[
                            styles.typeTagText,
                            ev.type === 'earnings' && { color: theme.green },
                            ev.type === 'macro' && { color: theme.accentBlue },
                            ev.type === 'fed' && { color: theme.accentOrange },
                          ]}>
                          {ev.type === 'earnings' ? '실적' : ev.type === 'fed' ? 'Fed' : '지표'}
                        </Text>
                      </View>
                      <Text style={styles.title} numberOfLines={3}>
                        {ev.title}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.time}>{ev.time}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <SignalBannerAd />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme) {
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
    listScroll: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingTop: 10 },
    listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
    hint: { fontSize: 10, color: theme.textDim, marginBottom: 8 },
    monthHeading: {
      fontSize: 13,
      fontWeight: '800',
      color: theme.text,
      marginBottom: 6,
    },
    dayHeader: {
      backgroundColor: theme.bg,
      paddingVertical: 5,
      marginTop: 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    dayHeaderText: { fontSize: 12, fontWeight: '800', color: theme.green },
    loading: { fontSize: 12, color: theme.textMuted, marginBottom: 8, paddingVertical: 4 },
    errBox: {
      padding: 10,
      borderRadius: 10,
      backgroundColor: '#2A1515',
      borderWidth: 1,
      borderColor: '#553333',
      marginBottom: 8,
    },
    errText: { fontSize: 11, color: '#E0A0A0', lineHeight: 16 },
    empty: { fontSize: 12, color: theme.textMuted, paddingVertical: 12, textAlign: 'center' },
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
    typeTagText: { fontSize: 9, fontWeight: '800' },
    time: { fontSize: 10, color: theme.textMuted, marginTop: 1, flexShrink: 0 },
    title: {
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      lineHeight: 18,
    },
  });
}
