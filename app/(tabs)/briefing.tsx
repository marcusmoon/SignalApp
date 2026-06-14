import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketSnapshotSection } from '@/components/summary/MarketSnapshotSection';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import { ThemedRefreshControl } from '@/components/signal/ThemedRefreshControl';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForSymbolsDisplay } from '@/services/companyNewsForSymbol';
import {
  earningsRowDate,
  earningsRowQuarter,
  earningsRowSymbol,
  earningsRowYear,
} from '@/domain/concalls/signalCalendarEarnings';
import {
  fetchSignalEarningsCalendarRangeMerged,
  fetchSignalMacroCalendarRangeMerged,
} from '@/integrations/signal-api/calendarRange';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import { fetchSignalMarketBriefings } from '@/integrations/signal-api/marketBriefings';
import type {
  SignalApiCalendarEvent,
  SignalApiMarketBriefing,
  SignalApiMarketQuote,
  SignalApiNewsItem,
} from '@/integrations/signal-api/types';
import { formatSignalApiError } from '@/integrations/signal-api/httpClient';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import {
  MARKET_SNAPSHOT_MACRO_ROWS,
  MARKET_SNAPSHOT_TAPE_SYMBOLS,
} from '@/services/marketSnapshotQuotes';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { hasSignalApi } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';
import { signalQuoteMovePct } from '@/utils/signalDisplay';
import type { MessageId } from '@/locales/messages';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BTN_PADDING_V,
  SEGMENT_TAB_BTN_RADIUS,
  SEGMENT_TAB_FONT_SIZE,
  SEGMENT_TAB_FONT_WEIGHT,
  SEGMENT_TAB_GAP,
  SEGMENT_TAB_LINE_HEIGHT,
  SEGMENT_TAB_OUTER_RADIUS,
  SEGMENT_TAB_PADDING,
} from '@/constants/segmentTabBar';

const WATCH_LIMIT = 10;
const EARN_DAYS = 21;
const MACRO_DAYS = 7;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function nextEarningForSymbol(rows: SignalApiCalendarEvent[], sym: string): SignalApiCalendarEvent | null {
  const u = sym.toUpperCase();
  const hits = rows
    .filter((r) => earningsRowSymbol(r) === u)
    .sort((a, b) => earningsRowDate(a).localeCompare(earningsRowDate(b)));
  return hits[0] ?? null;
}

/** `YYYY-MM-DD` → 짧은 월/일 (로케 숫자만) */
function shortMd(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  return `${Number(m[2])}/${Number(m[3])}`;
}

function shortDateTime(value: string | null | undefined): string {
  const text = String(value || '').trim();
  if (text.length >= 16) return `${shortMd(text.slice(0, 10))} ${text.slice(11, 16)}`;
  if (text.length >= 10) return shortMd(text.slice(0, 10));
  return text || '—';
}

function earningsInInclusiveRange(
  rows: SignalApiCalendarEvent[],
  fromYmd: string,
  toYmdInclusive: string,
): SignalApiCalendarEvent[] {
  return rows
    .filter((r) => {
      const d = earningsRowDate(r);
      return d >= fromYmd && d <= toYmdInclusive;
    })
    .sort(
      (a, b) =>
        earningsRowDate(a).localeCompare(earningsRowDate(b)) ||
        earningsRowSymbol(a).localeCompare(earningsRowSymbol(b)),
    );
}

function macroEventTimeLabel(ev: SignalApiCalendarEvent): string {
  const iso = ev.eventAt?.trim();
  if (iso && iso.length >= 16) {
    return `${shortMd(iso.slice(0, 10))} ${iso.slice(11, 16)}`;
  }
  if (ev.date && ev.timeLabel) return `${shortMd(ev.date)} ${ev.timeLabel.slice(0, 5)}`;
  return ev.date ? shortMd(ev.date) : '—';
}

function earningSortKey(r: SignalApiCalendarEvent): string {
  return `${earningsRowDate(r)}T12:00:00`;
}

function macroSortKey(ev: SignalApiCalendarEvent): string {
  const iso = ev.eventAt?.trim();
  if (iso && iso.length >= 19) return iso.replace(' ', 'T').slice(0, 19);
  if (iso && iso.length >= 16) return `${iso.slice(0, 10)}T${iso.slice(11, 16)}:00`;
  if (ev.date) {
    const tl = (ev.timeLabel || '12:00').trim();
    const hhmm = tl.length >= 5 ? tl.slice(0, 5) : '12:00';
    return `${ev.date}T${hhmm}:00`;
  }
  return '9999-12-31T23:59:59';
}

type ScheduleTabKey = 'all' | 'earnings' | 'macro';
type BriefingMarketKey = 'kr' | 'us';

const SCHEDULE_TAB_DEF: readonly { key: ScheduleTabKey; label: MessageId }[] = [
  { key: 'all', label: 'briefingScheduleTabAll' },
  { key: 'earnings', label: 'briefingScheduleTabEarnings' },
  { key: 'macro', label: 'briefingScheduleTabMacro' },
];

const MARKET_ORDER: readonly BriefingMarketKey[] = ['kr', 'us'];
const SESSION_ORDER: Record<BriefingMarketKey, readonly string[]> = {
  kr: ['morning', 'lunch', 'evening', 'close'],
  us: ['overnight', 'morning', 'close'],
};

export default function BriefingScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tape, setTape] = useState<Record<string, SignalApiMarketQuote | null>>({});
  const [macro, setMacro] = useState<Record<string, SignalApiMarketQuote | null>>({});
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<{ symbol: string; q: SignalApiMarketQuote | null }[]>([]);
  const [newsBySymbol, setNewsBySymbol] = useState<Record<string, SignalApiNewsItem[]>>({});
  const [earnings, setEarnings] = useState<SignalApiCalendarEvent[]>([]);
  const [economicWeek, setEconomicWeek] = useState<SignalApiCalendarEvent[]>([]);
  const [scheduleTab, setScheduleTab] = useState<ScheduleTabKey>('all');
  const [briefingMarket, setBriefingMarket] = useState<BriefingMarketKey>('kr');
  const [marketBriefings, setMarketBriefings] = useState<SignalApiMarketBriefing[]>([]);

  const load = useCallback(async () => {
    if (!hasSignalApi()) {
      setError(t('errorSignalApiShort'));
      setTape({});
      setMacro({});
      setSymbols([]);
      setQuotes([]);
      setNewsBySymbol({});
      setEarnings([]);
      setEconomicWeek([]);
      setMarketBriefings([]);
      return;
    }
    setError(null);
    const watch = (await loadWatchlistSymbols()).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const syms = watch.slice(0, WATCH_LIMIT);
    setSymbols(syms);

    const today = startOfLocalDay(new Date());
    const earnUntil = addDays(today, EARN_DAYS);
    const macroUntil = addDays(today, MACRO_DAYS);
    const snapshotTapeSyms = [...MARKET_SNAPSHOT_TAPE_SYMBOLS];
    const snapshotMacroSyms = MARKET_SNAPSHOT_MACRO_ROWS.map((row) => row.symbol);
    const quoteSymbols = [...new Set([...syms, ...snapshotTapeSyms, ...snapshotMacroSyms])];

    const [mqRows, earnRows, newsMap, econRows, briefingRows] = await Promise.all([
      quoteSymbols.length > 0
        ? fetchSignalMarketQuotes({ symbols: quoteSymbols, limit: Math.max(quoteSymbols.length, 1) }).catch(() => [])
        : Promise.resolve([]),
      fetchSignalEarningsCalendarRangeMerged(today, earnUntil).catch(() => [] as SignalApiCalendarEvent[]),
      fetchCompanyNewsForSymbolsDisplay(syms, locale).catch(() => ({} as Record<string, SignalApiNewsItem[]>)),
      fetchSignalMacroCalendarRangeMerged(today, macroUntil).catch(() => [] as SignalApiCalendarEvent[]),
      fetchSignalMarketBriefings({ limit: 8 }).catch(() => [] as SignalApiMarketBriefing[]),
    ]);

    const quoteMap = new Map(
      mqRows.map((r) => [String(r.symbol || '').trim().toUpperCase(), signalMarketQuoteHasValidPrice(r) ? r : null] as const),
    );

    const nextTape: Record<string, SignalApiMarketQuote | null> = {};
    for (const sym of snapshotTapeSyms) nextTape[sym] = quoteMap.get(sym) ?? null;
    setTape(nextTape);

    const nextMacro: Record<string, SignalApiMarketQuote | null> = {};
    for (const sym of snapshotMacroSyms) nextMacro[sym] = quoteMap.get(sym) ?? null;
    setMacro(nextMacro);

    const qRows = syms.map((sym) => {
      return { symbol: sym, q: quoteMap.get(sym) ?? null };
    });
    setQuotes(qRows);

    const watchSet = new Set(syms);
    setEarnings(
      earnRows
        .filter((r) => earningsRowSymbol(r) && watchSet.has(earningsRowSymbol(r)))
        .sort((a, b) => earningsRowDate(a).localeCompare(earningsRowDate(b))),
    );

    setNewsBySymbol(Object.fromEntries(syms.map((sym) => [sym, newsMap[sym] ?? []])));
    setMarketBriefings(
      [...briefingRows].sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''))),
    );

    const econSorted = [...econRows].sort((a, b) => {
      const ka = String(a.eventAt || a.date || '');
      const kb = String(b.eventAt || b.date || '');
      return ka.localeCompare(kb);
    });
    setEconomicWeek(econSorted);
  }, [locale, t]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

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

  const quoteBySymbol = useMemo(() => {
    const m: Record<string, SignalApiMarketQuote | null> = {};
    for (const { symbol, q } of quotes) {
      m[symbol] = q;
    }
    return m;
  }, [quotes]);

  const macroDisplay = useMemo(() => {
    return economicWeek.slice(0, 10);
  }, [economicWeek]);

  const notableSymbols = useMemo(() => {
    const today0 = startOfLocalDay(new Date());
    const toY = toYmd(addDays(today0, 6));
    const ranked = symbols
      .map((sym) => {
        const dp = signalQuoteMovePct(quoteBySymbol[sym]);
        const nextE = nextEarningForSymbol(earnings, sym);
        const nextEarningSoon = nextE ? earningsRowDate(nextE) <= toY : false;
        return {
          sym,
          moveAbs: Math.abs(Number.isFinite(dp) ? dp : 0),
          newsCount: newsBySymbol[sym]?.length ?? 0,
          nextEarningSoon,
        };
      })
      .sort((a, b) => {
        if (b.newsCount !== a.newsCount) return b.newsCount - a.newsCount;
        if (b.moveAbs !== a.moveAbs) return b.moveAbs - a.moveAbs;
        if (b.nextEarningSoon !== a.nextEarningSoon) return b.nextEarningSoon ? 1 : -1;
        return a.sym.localeCompare(b.sym);
      });
    const picked = ranked.filter(({ sym, moveAbs, newsCount, nextEarningSoon }) => {
      const dp = signalQuoteMovePct(quoteBySymbol[sym]);
      return (
        newsCount > 0 ||
        moveAbs >= 2 ||
        Math.abs(Number.isFinite(dp) ? dp : 0) >= 2 ||
        nextEarningSoon
      );
    });
    return (picked.length > 0 ? picked : ranked.slice(0, 3)).map((row) => row.sym).slice(0, 6);
  }, [earnings, newsBySymbol, quoteBySymbol, symbols]);

  const weekEarnings = useMemo(() => {
    if (symbols.length === 0) return [] as SignalApiCalendarEvent[];
    const today0 = startOfLocalDay(new Date());
    const fromY = toYmd(today0);
    const toY = toYmd(addDays(today0, 6));
    return earningsInInclusiveRange(earnings, fromY, toY);
  }, [earnings, symbols.length]);

  const briefingMarketRows = useMemo(() => {
    const selected = marketBriefings.filter((row) => row.market === briefingMarket);
    return selected.sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  }, [briefingMarket, marketBriefings]);

  const latestBriefing = briefingMarketRows[0] ?? null;
  const timelineBriefings = useMemo(() => {
    const order = SESSION_ORDER[briefingMarket] ?? [];
    return [...briefingMarketRows].sort((a, b) => {
      const ai = order.indexOf(a.session);
      const bi = order.indexOf(b.session);
      if (ai !== bi) return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
      return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
    });
  }, [briefingMarket, briefingMarketRows]);
  const archivedBriefings = timelineBriefings.filter((row) => row.id !== latestBriefing?.id).slice(0, 6);
  const hasAnyBriefing = marketBriefings.length > 0;

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

  const scheduleMerged = useMemo(() => {
    type Entry =
      | { kind: 'earning'; sortKey: string; row: SignalApiCalendarEvent }
      | { kind: 'macro'; sortKey: string; row: SignalApiCalendarEvent };
    const out: Entry[] = [];
    for (const row of weekEarnings) {
      out.push({ kind: 'earning', sortKey: earningSortKey(row), row });
    }
    for (const row of macroDisplay) {
      out.push({ kind: 'macro', sortKey: macroSortKey(row), row });
    }
    out.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    return out.slice(0, 14);
  }, [weekEarnings, macroDisplay]);

  const watchPreviewRows = useMemo(() => {
    return notableSymbols.slice(0, 3).map((sym) => {
      const q = quoteBySymbol[sym] ?? null;
      const topNews = newsBySymbol[sym]?.[0];
      const headline = (topNews?.originalTitle || topNews?.title || '').trim();
      return {
        symbol: sym,
        move: q ? formatPct(signalQuoteMovePct(q)) : '—',
        headline: headline || t('briefingSymbolNoNews'),
      };
    });
  }, [newsBySymbol, notableSymbols, quoteBySymbol, t]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{ title: t('screenBriefing') }} />
      {loading ? (
        <View style={styles.center}>
          <SignalLoadingIndicator message={t('commonLoading')} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          refreshControl={
            <ThemedRefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          <OtaUpdateBanner />

          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          {!error ? (
            <>
              <View style={styles.heroShell}>
                <View style={styles.heroTopRow}>
                  <Text style={styles.heroEyebrow}>{t('briefingHubEyebrow')}</Text>
                  <Text style={styles.heroUpdated}>
                    {latestBriefing ? shortDateTime(latestBriefing.publishedAt) : t('briefingHubWaitingBadge')}
                  </Text>
                </View>
                <Text style={styles.heroTitle}>{t('briefingHubTitle')}</Text>
                <Text style={styles.heroSubtitle}>{t('briefingHubSubtitle')}</Text>
              </View>

              <View style={styles.marketBriefingTabs}>
                {MARKET_ORDER.map((market) => (
                  <Pressable
                    key={market}
                    onPress={() => setBriefingMarket(market)}
                    style={[styles.marketBriefingTab, briefingMarket === market && styles.marketBriefingTabActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: briefingMarket === market }}>
                    <Text
                      style={[
                        styles.marketBriefingTabText,
                        briefingMarket === market && styles.marketBriefingTabTextActive,
                      ]}>
                      {briefingMarketLabel(market)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {latestBriefing ? (
                <Pressable
                  onPress={() => router.push(`/briefings/${latestBriefing.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={latestBriefing.title}
                  style={({ pressed }) => [styles.marketBriefingHero, pressed && styles.marketBriefingHeroPressed]}>
                  <View style={styles.marketBriefingHeroRow}>
                    <Text style={styles.marketBriefingKicker}>
                      {briefingMarketLabel(latestBriefing.market)} · {briefingSessionLabel(latestBriefing.session)}
                    </Text>
                    <Text style={styles.marketBriefingWhen}>{shortDateTime(latestBriefing.publishedAt)}</Text>
                  </View>
                  <Text style={styles.marketBriefingTitle}>{latestBriefing.title}</Text>
                  <Text style={styles.marketBriefingHeadline}>{latestBriefing.headline}</Text>
                  {latestBriefing.overview.slice(0, 3).map((line, index) => (
                    <Text key={`${latestBriefing.id}-overview-${index}`} style={styles.marketBriefingLine}>
                      {line}
                    </Text>
                  ))}
                  <Text style={styles.marketBriefingCta}>{t('briefingHubOpenDetail')}</Text>
                </Pressable>
              ) : (
                <View style={styles.emptyBriefingCard}>
                  <Text style={styles.emptyBriefingTitle}>
                    {hasAnyBriefing ? t('briefingHubMarketEmptyTitle') : t('briefingHubEmptyTitle')}
                  </Text>
                  <Text style={styles.emptyBriefingBody}>
                    {hasAnyBriefing ? t('briefingHubMarketEmptyBody') : t('briefingHubEmptyBody')}
                  </Text>
                </View>
              )}

              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleAccent} />
                <Text style={styles.blockTitleFlat}>{t('briefingHubTimelineTitle')}</Text>
              </View>
              <View style={styles.marketBriefingArchive}>
                {archivedBriefings.length > 0 ? (
                  archivedBriefings.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/briefings/${item.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={item.title}
                      style={({ pressed }) => [
                        styles.marketBriefingArchiveRow,
                        pressed && styles.marketBriefingArchiveRowPressed,
                      ]}>
                      <View style={styles.marketBriefingArchiveMain}>
                        <Text style={styles.marketBriefingArchiveLabel}>
                          {briefingSessionLabel(item.session)} · {shortDateTime(item.publishedAt)}
                        </Text>
                        <Text style={styles.marketBriefingArchiveTitle} numberOfLines={2}>
                          {item.headline}
                        </Text>
                      </View>
                      <Text style={styles.marketBriefingArchiveWhen}>{t('briefingHubOpenBrief')}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.weekStripEmpty}>
                    {latestBriefing ? t('briefingHubTimelineEmpty') : t('briefingHubTimelineWaiting')}
                  </Text>
                )}
              </View>

              <View style={styles.marketSnapshotSpacing}>
                <MarketSnapshotSection tape={tape} macro={macro} compact />
              </View>

              <View style={styles.watchPanel}>
                <View style={styles.watchPanelHead}>
                  <View>
                    <Text style={styles.watchPanelKicker}>{t('briefingHubWatchKicker')}</Text>
                    <Text style={styles.watchPanelTitle}>{t('briefingHubWatchTitle')}</Text>
                  </View>
                  <Pressable
                    onPress={() => router.push('/insights')}
                    accessibilityRole="button"
                    accessibilityLabel={t('briefingOpenTodaySignal')}
                    style={({ pressed }) => [styles.digestSignalLink, pressed && styles.digestSignalLinkPressed]}>
                    <Text style={styles.digestSignalLinkText}>{t('briefingOpenTodaySignal')}</Text>
                  </Pressable>
                </View>
                {watchPreviewRows.length > 0 ? (
                  <View style={styles.watchPreviewList}>
                    {watchPreviewRows.map((row) => (
                      <Pressable
                        key={row.symbol}
                        onPress={() => router.push(`/symbol/${row.symbol}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${row.symbol} ${row.headline}`}
                        style={({ pressed }) => [styles.watchPreviewRow, pressed && styles.marketBriefingArchiveRowPressed]}>
                        <View style={styles.watchPreviewSymbolBox}>
                          <Text style={styles.watchPreviewSymbol}>{row.symbol}</Text>
                          <Text style={styles.watchPreviewMove}>{row.move}</Text>
                        </View>
                        <Text style={styles.watchPreviewHeadline} numberOfLines={2}>{row.headline}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.muted}>{t('briefingEmptyWatchlist')}</Text>
                )}
              </View>

              <View style={[styles.sectionTitleRow, styles.scheduleBlockTitle]}>
                <View style={styles.sectionTitleAccent} />
                <Text style={styles.blockTitleFlat}>{t('briefingScheduleSectionTitle')}</Text>
              </View>
              <View style={styles.scheduleSegment}>
                {SCHEDULE_TAB_DEF.map(({ key, label }) => (
                  <Pressable
                    key={key}
                    onPress={() => setScheduleTab(key)}
                    style={[styles.scheduleSegBtn, scheduleTab === key && styles.scheduleSegBtnActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: scheduleTab === key }}>
                    <Text style={[styles.scheduleSegText, scheduleTab === key && styles.scheduleSegTextActive]}>
                      {t(label)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.compactList}>
                {scheduleTab === 'all' ? (
                  scheduleMerged.length === 0 ? (
                    <Text style={styles.weekStripEmpty}>{t('briefingScheduleMergedEmpty')}</Text>
                  ) : (
                    scheduleMerged.slice(0, 6).map((entry, idx) =>
                      entry.kind === 'earning' ? (
                        <Pressable
                          key={`sched-e-${earningsRowSymbol(entry.row)}-${idx}`}
                          style={styles.compactEventRow}
                          onPress={() => router.push(`/symbol/${earningsRowSymbol(entry.row)}`)}
                          accessibilityRole="button"
                          accessibilityLabel={`${earningsRowSymbol(entry.row)} ${earningsRowDate(entry.row)}`}>
                          <View style={styles.scheduleKindBadge}>
                            <Text style={styles.scheduleKindBadgeText}>{t('briefingScheduleKindEarning')}</Text>
                          </View>
                          <View style={styles.compactEventMain}>
                            <Text style={styles.compactEventTitle} numberOfLines={1}>
                              {earningsRowSymbol(entry.row)}
                            </Text>
                            <Text style={styles.compactEventMeta} numberOfLines={1}>
                              {t('fiscalYearQuarterShort', {
                                y: earningsRowYear(entry.row),
                                q: earningsRowQuarter(entry.row),
                              })}
                            </Text>
                          </View>
                          <Text style={styles.compactEventDate}>{shortMd(earningsRowDate(entry.row))}</Text>
                        </Pressable>
                      ) : (
                        <View
                          key={`sched-m-${entry.row.id ?? 'x'}-${idx}-${entry.row.eventAt || entry.row.date || ''}`}
                          style={[
                            styles.compactEventRow,
                            entry.row.impact?.toLowerCase() === 'high' && styles.compactEventRowHot,
                          ]}>
                          <View style={[styles.scheduleKindBadge, styles.scheduleKindBadgeMacro]}>
                            <Text style={[styles.scheduleKindBadgeText, styles.scheduleKindBadgeTextMacro]}>
                              {t('briefingScheduleKindMacro')}
                            </Text>
                          </View>
                          <View style={styles.compactEventMain}>
                            <Text style={styles.compactEventTitle} numberOfLines={2}>
                              {entry.row.title}
                            </Text>
                            <Text style={styles.compactEventMeta} numberOfLines={1}>
                              {entry.row.country || '—'}
                              {entry.row.impact?.toLowerCase() === 'high'
                                ? ` · ${t('briefingMacroImpactHigh')}`
                                : ''}
                            </Text>
                          </View>
                          <Text style={styles.compactEventDate} numberOfLines={1}>
                            {macroEventTimeLabel(entry.row)}
                          </Text>
                        </View>
                      ),
                    )
                  )
                ) : scheduleTab === 'earnings' ? (
                  weekEarnings.length === 0 ? (
                    <Text style={styles.weekStripEmpty}>{t('briefingWeekEarningsEmpty')}</Text>
                  ) : (
                    weekEarnings.slice(0, 6).map((r) => (
                      <Pressable
                        key={`${earningsRowSymbol(r)}-${earningsRowDate(r)}-${earningsRowQuarter(r)}-${earningsRowYear(r)}`}
                        style={styles.compactEventRow}
                        onPress={() => router.push(`/symbol/${earningsRowSymbol(r)}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${earningsRowSymbol(r)} ${earningsRowDate(r)}`}>
                        <View style={styles.compactEventMain}>
                          <Text style={styles.compactEventTitle} numberOfLines={1}>
                            {earningsRowSymbol(r)}
                          </Text>
                          <Text style={styles.compactEventMeta} numberOfLines={1}>
                            {t('fiscalYearQuarterShort', { y: earningsRowYear(r), q: earningsRowQuarter(r) })}
                          </Text>
                        </View>
                        <Text style={styles.compactEventDate}>{shortMd(earningsRowDate(r))}</Text>
                      </Pressable>
                    ))
                  )
                ) : macroDisplay.length === 0 ? (
                  <Text style={styles.macroEmpty}>{t('briefingMacroEmpty')}</Text>
                ) : (
                  macroDisplay.slice(0, 6).map((r) => (
                    <View
                      key={`${r.id}-${r.eventAt || r.date || r.title}`}
                      style={[
                        styles.compactEventRow,
                        r.impact?.toLowerCase() === 'high' && styles.compactEventRowHot,
                      ]}>
                      <View style={styles.compactEventMain}>
                        <Text style={styles.compactEventTitle} numberOfLines={2}>
                          {r.title}
                        </Text>
                        <Text style={styles.compactEventMeta} numberOfLines={1}>
                          {r.country || '—'}
                          {r.impact?.toLowerCase() === 'high' ? ` · ${t('briefingMacroImpactHigh')}` : ''}
                        </Text>
                      </View>
                      <Text style={styles.compactEventDate} numberOfLines={1}>
                        {macroEventTimeLabel(r)}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
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
    content: { paddingHorizontal: 16, paddingTop: 8 },
    heroShell: {
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.card,
      paddingVertical: 18,
      paddingHorizontal: 18,
      marginBottom: 12,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    heroEyebrow: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(11),
      fontWeight: '900',
      letterSpacing: 0.7,
      color: theme.green,
      textTransform: 'uppercase',
    },
    heroUpdated: {
      flexShrink: 0,
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.textMuted,
    },
    heroTitle: {
      fontSize: sf(25),
      lineHeight: sf(31),
      fontWeight: '900',
      letterSpacing: -0.8,
      color: theme.text,
      marginBottom: 8,
    },
    heroSubtitle: {
      fontSize: sf(13),
      lineHeight: sf(20),
      fontWeight: '700',
      color: theme.textDim,
    },
    marketBriefingWrap: {
      marginBottom: 16,
    },
    marketBriefingTabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    marketBriefingTab: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      alignItems: 'center',
    },
    marketBriefingTabActive: {
      backgroundColor: theme.green,
      borderColor: theme.green,
    },
    marketBriefingTabText: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.textDim,
    },
    marketBriefingTabTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    marketBriefingHero: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: digestBg,
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    marketBriefingHeroPressed: {
      opacity: 0.84,
    },
    marketBriefingHeroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    marketBriefingKicker: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(10),
      fontWeight: '900',
      letterSpacing: 0.5,
      color: theme.green,
      textTransform: 'uppercase',
    },
    marketBriefingWhen: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
    },
    marketBriefingTitle: {
      fontSize: sf(18),
      fontWeight: '900',
      color: theme.text,
      lineHeight: sf(24),
      marginBottom: 6,
    },
    marketBriefingHeadline: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.textDim,
      lineHeight: sf(18),
      marginBottom: 10,
    },
    marketBriefingLine: {
      fontSize: sf(12),
      fontWeight: '700',
      color: theme.text,
      lineHeight: sf(17),
      marginTop: 4,
    },
    marketBriefingCta: {
      alignSelf: 'flex-start',
      marginTop: 14,
      paddingVertical: 7,
      paddingHorizontal: 11,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.green,
      color: SEGMENT_TAB_ACTIVE_TEXT,
      fontSize: sf(11),
      fontWeight: '900',
    },
    emptyBriefingCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 18,
      paddingHorizontal: 16,
      marginBottom: 14,
    },
    emptyBriefingTitle: {
      fontSize: sf(17),
      lineHeight: sf(23),
      fontWeight: '900',
      color: theme.text,
      marginBottom: 8,
    },
    emptyBriefingBody: {
      fontSize: sf(12),
      lineHeight: sf(18),
      fontWeight: '700',
      color: theme.textDim,
    },
    marketBriefingArchive: {
      gap: 8,
      marginTop: 10,
    },
    marketBriefingArchiveRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    marketBriefingArchiveRowPressed: {
      opacity: 0.82,
    },
    marketBriefingArchiveMain: {
      flex: 1,
      minWidth: 0,
    },
    marketBriefingArchiveLabel: {
      fontSize: sf(10),
      fontWeight: '900',
      color: theme.green,
      marginBottom: 3,
    },
    marketBriefingArchiveTitle: {
      fontSize: sf(12),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(17),
    },
    marketBriefingArchiveWhen: {
      flexShrink: 0,
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
      textAlign: 'right',
    },
    digestWrap: {
      marginBottom: 16,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: theme.greenBorder,
      backgroundColor: digestBg,
    },
    digestTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 10,
    },
    digestKicker: {
      fontSize: sf(10),
      fontWeight: '800',
      letterSpacing: 1.1,
      color: theme.green,
      textTransform: 'uppercase',
      flex: 1,
      minWidth: 0,
    },
    digestHeadline: {
      fontSize: sf(18),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(25),
      letterSpacing: -0.35,
    },
    digestMore: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.greenBorder,
    },
    digestMoreLine: { fontSize: sf(12), fontWeight: '600', color: theme.textDim, lineHeight: sf(18) },
    digestMoreLineGap: { marginTop: 8 },
    digestSignalLink: {
      flexShrink: 0,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: theme.greenDim,
    },
    digestSignalLinkPressed: {
      opacity: 0.78,
    },
    digestSignalLinkText: {
      fontSize: sf(11),
      lineHeight: sf(14),
      fontWeight: '900',
      color: theme.green,
    },
    watchPanel: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bgElevated,
      paddingVertical: 14,
      paddingHorizontal: 14,
      marginTop: 8,
      marginBottom: 14,
    },
    watchPanelHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 10,
      marginBottom: 12,
    },
    watchPanelKicker: {
      fontSize: sf(10),
      fontWeight: '900',
      letterSpacing: 0.6,
      color: theme.green,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    watchPanelTitle: {
      fontSize: sf(15),
      fontWeight: '900',
      color: theme.text,
    },
    watchPreviewList: {
      gap: 8,
    },
    watchPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    watchPreviewSymbolBox: {
      width: 62,
      flexShrink: 0,
    },
    watchPreviewSymbol: {
      fontSize: sf(13),
      fontWeight: '900',
      color: theme.green,
    },
    watchPreviewMove: {
      marginTop: 3,
      fontSize: sf(10),
      fontWeight: '800',
      color: theme.textMuted,
    },
    watchPreviewHeadline: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(12),
      lineHeight: sf(17),
      fontWeight: '700',
      color: theme.text,
    },
    muted: { fontSize: sf(12), color: theme.textDim, marginTop: 4, marginBottom: 12 },
    blockTitleFlat: {
      fontSize: sf(13),
      fontWeight: '900',
      letterSpacing: -0.2,
      color: theme.text,
      flex: 1,
      minWidth: 0,
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 6,
      marginBottom: 8,
    },
    sectionTitleAccent: {
      width: 4,
      height: 18,
      borderRadius: 2,
      backgroundColor: theme.green,
    },
    scheduleBlockTitle: {
      marginTop: 14,
    },
    focusCarousel: {
      marginHorizontal: -16,
      marginBottom: 14,
    },
    focusCarouselContent: {
      paddingHorizontal: 16,
      gap: 10,
      paddingBottom: 2,
    },
    focusCard: {
      minWidth: 0,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      backgroundColor: digestBg,
    },
    focusCardPressed: {
      opacity: 0.82,
    },
    focusTitle: {
      fontSize: sf(10),
      fontWeight: '900',
      color: theme.green,
      marginBottom: 8,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    focusHeadline: {
      fontSize: sf(15),
      lineHeight: sf(20),
      fontWeight: '900',
      color: theme.text,
      marginBottom: 8,
    },
    focusMeta: {
      fontSize: sf(11),
      lineHeight: sf(15),
      fontWeight: '700',
      color: theme.textDim,
    },
    marketSnapshotSpacing: {
      marginTop: 6,
      marginBottom: 8,
    },
    scheduleSegment: {
      flexDirection: 'row',
      backgroundColor: theme.bgElevated,
      borderRadius: SEGMENT_TAB_OUTER_RADIUS,
      borderWidth: 1,
      borderColor: theme.border,
      padding: SEGMENT_TAB_PADDING,
      marginBottom: 10,
      gap: SEGMENT_TAB_GAP,
    },
    scheduleSegBtn: {
      flex: 1,
      paddingVertical: SEGMENT_TAB_BTN_PADDING_V,
      borderRadius: SEGMENT_TAB_BTN_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scheduleSegBtnActive: {
      backgroundColor: theme.green,
    },
    scheduleSegText: {
      fontSize: sf(SEGMENT_TAB_FONT_SIZE),
      lineHeight: sf(SEGMENT_TAB_LINE_HEIGHT),
      fontWeight: SEGMENT_TAB_FONT_WEIGHT,
      color: theme.textDim,
    },
    scheduleSegTextActive: {
      color: SEGMENT_TAB_ACTIVE_TEXT,
    },
    scheduleKindBadge: {
      flexShrink: 0,
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 8,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
      alignSelf: 'center',
    },
    scheduleKindBadgeMacro: {
      backgroundColor: `${theme.accentBlue}22`,
      borderColor: `${theme.accentBlue}66`,
    },
    scheduleKindBadgeText: {
      fontSize: sf(9),
      fontWeight: '900',
      color: theme.green,
    },
    scheduleKindBadgeTextMacro: {
      color: theme.accentBlue,
    },
    macroEmpty: {
      fontSize: sf(11),
      color: theme.textDim,
      marginBottom: 10,
      lineHeight: sf(16),
    },
    weekStripEmpty: {
      fontSize: sf(11),
      color: theme.textDim,
      marginBottom: 10,
      lineHeight: sf(16),
    },
    compactList: {
      gap: 8,
      marginBottom: 14,
    },
    compactEventRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      paddingVertical: 11,
      paddingHorizontal: 12,
    },
    compactEventRowHot: {
      borderLeftWidth: 4,
      borderLeftColor: theme.accentOrange,
    },
    compactEventMain: {
      flex: 1,
      minWidth: 0,
    },
    compactEventTitle: {
      fontSize: sf(13),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(17),
    },
    compactEventMeta: {
      marginTop: 3,
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
      lineHeight: sf(13),
    },
    compactEventDate: {
      flexShrink: 0,
      maxWidth: 86,
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
      textAlign: 'right',
    },
    briefCard: {
      marginBottom: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      paddingLeft: 13,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    briefCardHot: {
      borderLeftWidth: 4,
      paddingLeft: 11,
      borderLeftColor: theme.accentOrange,
      backgroundColor: theme.accentOrange + '0C',
    },
    briefCardWatch: {
      borderLeftWidth: 4,
      paddingLeft: 11,
      borderLeftColor: theme.green,
      backgroundColor: digestBg,
    },
    briefCardQuiet: {
      borderLeftWidth: 3,
      paddingLeft: 12,
      borderLeftColor: theme.border,
    },
    briefCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    briefCardSym: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(17),
      fontWeight: '900',
      color: theme.green,
      letterSpacing: -0.3,
    },
    briefCardValues: { flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: 2 },
    briefCardPrice: { fontSize: sf(15), fontWeight: '800', color: theme.text, textAlign: 'right' },
    briefCardPct: { fontSize: sf(13), fontWeight: '800', textAlign: 'right' },
    up: { color: theme.green },
    dn: { color: '#ff6b6b' },
    briefCardStory: {
      fontSize: sf(14),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(21),
    },
    briefCardReason: {
      marginTop: 10,
      fontSize: sf(11),
      fontWeight: '800',
      color: theme.green,
      lineHeight: sf(16),
    },
    briefCardMeta: {
      marginTop: 5,
      fontSize: sf(11),
      fontWeight: '600',
      color: theme.textDim,
      lineHeight: sf(16),
    },
    briefCardNewsCue: {
      marginTop: 8,
      fontSize: sf(10),
      fontWeight: '600',
      color: theme.textMuted,
    },
    errBox: {
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
    },
    errText: { color: theme.text, fontSize: sf(12) },
  });
}
