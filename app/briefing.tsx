import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketSnapshotSection } from '@/components/summary/MarketSnapshotSection';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForSymbolsDisplay } from '@/services/companyNewsForSymbol';
import {
  earningsRowDate,
  earningsRowHour,
  earningsRowQuarter,
  earningsRowSymbol,
  earningsRowYear,
} from '@/domain/concalls/signalCalendarEarnings';
import {
  fetchSignalEarningsCalendarRangeMerged,
  fetchSignalMacroCalendarRangeMerged,
} from '@/integrations/signal-api/calendarRange';
import { fetchSignalMarketQuotes } from '@/integrations/signal-api/market';
import type {
  SignalApiCalendarEvent,
  SignalApiMarketQuote,
  SignalApiNewsItem,
} from '@/integrations/signal-api/types';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import { buildSignalScore } from '@/domain/signals';
import {
  MARKET_SNAPSHOT_MACRO_ROWS,
  MARKET_SNAPSHOT_TAPE_SYMBOLS,
} from '@/services/marketSnapshotQuotes';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { hasSignalApi } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';
import { signalQuoteMovePct, signalReasonLabel } from '@/utils/signalDisplay';
import type { MessageId } from '@/locales/messages';
import {
  SEGMENT_TAB_ACTIVE_TEXT,
  SEGMENT_TAB_BACKGROUND,
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
const NEWS_DENSE_MIN = 4;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
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

/** 경제 이벤트 `time` (예: `2025-04-02 08:30:00`) → 표시용 */
function macroWhenLabel(time: string): string {
  if (time.length >= 16) {
    const ymd = time.slice(0, 10);
    return `${shortMd(ymd)} ${time.slice(11, 16)}`;
  }
  if (time.length >= 10) return shortMd(time.slice(0, 10));
  return time;
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

const SCHEDULE_TAB_DEF: readonly { key: ScheduleTabKey; label: MessageId }[] = [
  { key: 'all', label: 'briefingScheduleTabAll' },
  { key: 'earnings', label: 'briefingScheduleTabEarnings' },
  { key: 'macro', label: 'briefingScheduleTabMacro' },
];

export default function BriefingScreen() {
  const { theme, scaleFont } = useSignalTheme();
  const { t, locale } = useLocale();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(theme, scaleFont), [theme, scaleFont]);
  const focusCardWidth = Math.round(Math.min(300, Math.max(248, windowWidth * 0.74)));

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

    const [mqRows, earnRows, newsMap, econRows] = await Promise.all([
      quoteSymbols.length > 0
        ? fetchSignalMarketQuotes({ symbols: quoteSymbols, pageSize: Math.max(quoteSymbols.length, 1) }).catch(() => [])
        : Promise.resolve([]),
      fetchSignalEarningsCalendarRangeMerged(today, earnUntil).catch(() => [] as SignalApiCalendarEvent[]),
      fetchCompanyNewsForSymbolsDisplay(syms, locale).catch(() => ({} as Record<string, SignalApiNewsItem[]>)),
      fetchSignalMacroCalendarRangeMerged(today, macroUntil).catch(() => [] as SignalApiCalendarEvent[]),
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
        if (!cancelled) setError(e instanceof Error ? e.message : t('briefingErrorLoad'));
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

  const signalRows = useMemo(() => {
    const todayYmd = toYmd(startOfLocalDay(new Date()));
    return symbols
      .map((sym) =>
        buildSignalScore({
          symbol: sym,
          quote: quoteBySymbol[sym],
          news: newsBySymbol[sym] ?? [],
          nextEarning: nextEarningForSymbol(earnings, sym),
          vsSmaPct: null,
          todayYmd,
        }),
      )
      .sort((a, b) => b.score - a.score || b.newsCount - a.newsCount || a.symbol.localeCompare(b.symbol))
      .slice(0, 20);
  }, [earnings, newsBySymbol, quoteBySymbol, symbols]);

  const notableSymbols = useMemo(() => {
    const today0 = startOfLocalDay(new Date());
    const toY = toYmd(addDays(today0, 6));
    const ranked = signalRows.map((row) => row.symbol);
    const picked = ranked.filter((sym) => {
      const row = signalRows.find((r) => r.symbol === sym);
      const dp = signalQuoteMovePct(quoteBySymbol[sym]);
      const nextE = nextEarningForSymbol(earnings, sym);
      const nextEarningSoon = nextE ? earningsRowDate(nextE) <= toY : false;
      return (
        row?.level !== 'quiet' ||
        (newsBySymbol[sym]?.length ?? 0) > 0 ||
        Math.abs(Number.isFinite(dp) ? dp : 0) >= 2 ||
        nextEarningSoon
      );
    });
    return (picked.length > 0 ? picked : ranked.slice(0, 3)).slice(0, 6);
  }, [earnings, newsBySymbol, quoteBySymbol, signalRows]);

  const { weekEarnings, pulseLines } = useMemo(() => {
    if (symbols.length === 0) {
      return { weekEarnings: [] as SignalApiCalendarEvent[], pulseLines: [] as string[] };
    }
    const today0 = startOfLocalDay(new Date());
    const fromY = toYmd(today0);
    const toY = toYmd(addDays(today0, 6));
    const week = earningsInInclusiveRange(earnings, fromY, toY);

    let up = 0;
    let down = 0;
    let flat = 0;
    for (const sym of symbols) {
      const q = quoteBySymbol[sym];
      const dp = signalQuoteMovePct(q);
      if (!Number.isFinite(dp)) continue;
      if (dp > 0.01) up += 1;
      else if (dp < -0.01) down += 1;
      else flat += 1;
    }
    const lines: string[] = [t('briefingPulseUpDown', { up, down, flat })];

    const sortedNews = [...symbols].sort(
      (a, b) => (newsBySymbol[b]?.length ?? 0) - (newsBySymbol[a]?.length ?? 0),
    );
    const dense = sortedNews.filter((s) => (newsBySymbol[s]?.length ?? 0) >= NEWS_DENSE_MIN).slice(0, 4);
    if (dense.length > 0) {
      lines.push(t('briefingPulseNewsDense', { tickers: dense.join(', ') }));
    }

    const movers = symbols
      .map((sym) => {
        const q = quoteBySymbol[sym];
        const dp = signalQuoteMovePct(q);
        return { sym, abs: Number.isFinite(dp) ? Math.abs(dp) : 0, dp };
      })
      .filter((x) => x.abs >= 2)
      .sort((a, b) => b.abs - a.abs)
      .slice(0, 3)
      .map((x) => `${x.sym} ${formatPct(x.dp)}`);
    if (movers.length > 0) {
      lines.push(t('briefingPulseVolatility', { list: movers.join(' · ') }));
    }

    const m0 = macroDisplay[0];
    if (m0) {
      lines.push(
        t('briefingPulseMacroNext', {
          country: m0.country || '—',
          when: macroEventTimeLabel(m0),
          event: String(m0.title || '').trim() || '—',
        }),
      );
    }

    return { weekEarnings: week, pulseLines: lines };
  }, [symbols, quoteBySymbol, earnings, newsBySymbol, macroDisplay, t]);

  const digestHeadline = useMemo(() => {
    if (symbols.length === 0) return t('briefingDigestEmptyWatch');
    return pulseLines[0] ?? '';
  }, [symbols.length, pulseLines, t]);

  const digestTailLines = useMemo(() => {
    if (symbols.length === 0) return [];
    return pulseLines.slice(1);
  }, [symbols.length, pulseLines]);

  const focusCards = useMemo(() => {
    const cards: { key: string; title: string; headline: string; meta: string; symbol?: string }[] = [];

    const topSignal = signalRows[0];
    if (topSignal) {
      const reasons = topSignal.reasons.slice(0, 2).map((reason) => signalReasonLabel(reason, t));
      cards.push({
        key: 'signal',
        title: t('briefingFocusSignal'),
        headline: t('briefingFocusSignalHeadline', {
          symbol: topSignal.symbol,
          score: String(topSignal.score),
        }),
        meta: reasons.length > 0 ? reasons.join(' · ') : t('signalReasonWatch'),
        symbol: topSignal.symbol,
      });
    }

    const topMover = symbols
      .map((sym) => {
        const move = signalQuoteMovePct(quoteBySymbol[sym]);
        return { sym, move, abs: Number.isFinite(move) ? Math.abs(move) : 0 };
      })
      .filter((row) => row.abs > 0)
      .sort((a, b) => b.abs - a.abs)[0];
    if (topMover) {
      cards.push({
        key: 'mover',
        title: t('briefingFocusMover'),
        headline: t('briefingFocusMoverHeadline', {
          symbol: topMover.sym,
          move: formatPct(topMover.move),
        }),
        meta: t('briefingFocusMoverMeta'),
        symbol: topMover.sym,
      });
    }

    const nextEarning = weekEarnings[0] ?? earnings[0];
    if (nextEarning) {
      const symbol = earningsRowSymbol(nextEarning);
      cards.push({
        key: 'earnings',
        title: t('briefingFocusEarnings'),
        headline: t('briefingFocusEarningsHeadline', {
          symbol,
          date: shortMd(earningsRowDate(nextEarning)),
        }),
        meta: t('fiscalYearQuarterShort', {
          y: earningsRowYear(nextEarning),
          q: earningsRowQuarter(nextEarning),
        }),
        symbol,
      });
    }

    if (cards.length < 3 && macroDisplay[0]) {
      const ev = macroDisplay[0];
      cards.push({
        key: 'macro',
        title: t('briefingFocusMacro'),
        headline: t('briefingFocusMacroHeadline', {
          country: ev.country || '—',
          event: String(ev.title || '').trim() || '—',
        }),
        meta: macroEventTimeLabel(ev),
      });
    }

    return cards.slice(0, 3);
  }, [earnings, macroDisplay, quoteBySymbol, signalRows, symbols, t, weekEarnings]);

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
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.green} />
          }>
          <OtaUpdateBanner />

          {error ? (
            <View style={styles.errBox}>
              <Text style={styles.errText}>{error}</Text>
            </View>
          ) : null}

          {!error ? (
            <View style={styles.digestWrap}>
              <View style={styles.digestTopRow}>
                <Text style={styles.digestKicker}>{t('briefingDigestKicker')}</Text>
                <Pressable
                  onPress={() => router.push('/insights')}
                  accessibilityRole="button"
                  accessibilityLabel={t('briefingOpenTodaySignal')}
                  style={({ pressed }) => [styles.digestSignalLink, pressed && styles.digestSignalLinkPressed]}>
                  <Text style={styles.digestSignalLinkText}>{t('briefingOpenTodaySignal')}</Text>
                </Pressable>
              </View>
              <Text style={styles.digestHeadline}>{digestHeadline}</Text>
              {digestTailLines.length > 0 ? (
                <View style={styles.digestMore}>
                  {digestTailLines.map((line, i) => (
                    <Text key={i} style={[styles.digestMoreLine, i > 0 && styles.digestMoreLineGap]}>
                      {line}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {!error && focusCards.length > 0 ? (
            <>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionTitleAccent} />
                <Text style={styles.blockTitleFlat}>{t('briefingFocusTitle')}</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.focusCarousel}
                contentContainerStyle={styles.focusCarouselContent}>
                {focusCards.map((card) => (
                  <Pressable
                    key={card.key}
                    disabled={!card.symbol}
                    onPress={() => {
                      if (card.symbol) router.push(`/symbol/${card.symbol}`);
                    }}
                    accessibilityRole={card.symbol ? 'button' : 'text'}
                    style={({ pressed }) => [
                      styles.focusCard,
                      { width: focusCardWidth },
                      pressed && Boolean(card.symbol) && styles.focusCardPressed,
                    ]}>
                    <Text style={styles.focusTitle}>{card.title}</Text>
                    <Text style={styles.focusHeadline} numberOfLines={2}>
                      {card.headline}
                    </Text>
                    <Text style={styles.focusMeta} numberOfLines={2}>
                      {card.meta}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {!error ? (
            <>
              {symbols.length > 0 ? (
                <>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.sectionTitleAccent} />
                    <Text style={styles.blockTitleFlat}>{t('briefingSectionInsights')}</Text>
                  </View>
                  <Text style={styles.sectionHint}>{t('briefingSectionInsightsHint')}</Text>
                  {notableSymbols.map((sym) => {
                    const signal = signalRows.find((row) => row.symbol === sym);
                    const q = quoteBySymbol[sym] ?? null;
                    const list = newsBySymbol[sym] ?? [];
                    const topNews = list[0];
                    const nextE = nextEarningForSymbol(earnings, sym);
                    const dp = signalQuoteMovePct(q);
                    const up = (Number.isFinite(dp) ? dp : 0) >= 0;
                    const newsLine = t('briefingRowNewsCount', { count: String(list.length) });
                    const noEarn = t('briefingNoUpcomingEarning');
                    let earnLine = noEarn;
                    if (nextE) {
                      const h = earningsRowHour(nextE).trim().toLowerCase();
                      const hourLabel =
                        h === 'bmo' ? t('briefingEarnHourBmo') : h === 'amc' ? t('briefingEarnHourAmc') : earningsRowHour(nextE) || '—';
                      earnLine = t('briefingRowEarnLine', {
                        date: shortMd(earningsRowDate(nextE)),
                        y: String(earningsRowYear(nextE)),
                        q: String(earningsRowQuarter(nextE)),
                        hour: hourLabel,
                      });
                    }
                    const headline = (topNews?.originalTitle || topNews?.title || '').trim();
                    const primaryStory = headline || (earnLine !== noEarn ? earnLine : newsLine);
                    const subMeta: string[] = [];
                    const reasons =
                      signal?.reasons && signal.reasons.length > 0
                        ? signal.reasons.slice(0, 2).map((r) => signalReasonLabel(r, t))
                        : [t('signalReasonWatch')];
                    if (headline) {
                      subMeta.push(newsLine);
                      if (earnLine !== noEarn) subMeta.push(earnLine);
                    } else if (earnLine !== noEarn) {
                      subMeta.push(newsLine);
                    }

                    return (
                      <Pressable
                        key={sym}
                        style={[
                          styles.briefCard,
                          signal?.level === 'hot' && styles.briefCardHot,
                          signal?.level === 'watch' && styles.briefCardWatch,
                          signal?.level === 'quiet' && styles.briefCardQuiet,
                        ]}
                        onPress={() => router.push(`/symbol/${sym}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${sym} ${primaryStory}`}>
                        <View style={styles.briefCardHead}>
                          <Text style={styles.briefCardSym} numberOfLines={1}>
                            {sym}
                          </Text>
                          {signal ? (
                            <View
                              style={[
                                styles.briefScorePill,
                                signal.level === 'hot' && styles.briefScorePillHot,
                                signal.level === 'quiet' && styles.briefScorePillQuiet,
                              ]}>
                              <Text
                                style={[
                                  styles.briefScoreText,
                                  signal.level === 'hot' && styles.briefScoreTextHot,
                                  signal.level === 'quiet' && styles.briefScoreTextQuiet,
                                ]}>
                                {signal.score}
                              </Text>
                            </View>
                          ) : null}
                          <View style={styles.briefCardValues}>
                            <Text style={styles.briefCardPrice}>
                              {q && typeof q.currentPrice === 'number' ? formatUsd(q.currentPrice) : '—'}
                            </Text>
                            <Text style={[styles.briefCardPct, up ? styles.up : styles.dn]}>
                              {q ? formatPct(dp) : '—'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.briefCardStory} numberOfLines={3}>
                          {primaryStory}
                        </Text>
                        <Text style={styles.briefCardReason} numberOfLines={1}>
                          {reasons.join(' · ')}
                        </Text>
                        {subMeta.map((line, i) => (
                          <Text key={`${sym}-m-${i}`} style={styles.briefCardMeta}>
                            {line}
                          </Text>
                        ))}
                        {!headline ? (
                          <Text style={styles.briefCardNewsCue}>{t('briefingSymbolNoNews')}</Text>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </>
              ) : (
                <Text style={styles.muted}>{t('briefingEmptyWatchlist')}</Text>
              )}

              <View style={styles.marketSnapshotSpacing}>
                <MarketSnapshotSection tape={tape} macro={macro} compact />
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
                    <Text
                      style={[styles.scheduleSegText, scheduleTab === key && styles.scheduleSegTextActive]}>
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
                    scheduleMerged.map((entry, idx) =>
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
                    weekEarnings.slice(0, 8).map((r) => (
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
                  macroDisplay.slice(0, 8).map((r) => (
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
      backgroundColor: SEGMENT_TAB_BACKGROUND,
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
    sectionHint: {
      fontSize: sf(11),
      color: theme.textDim,
      fontWeight: '600',
      lineHeight: sf(16),
      marginTop: -4,
      marginBottom: 10,
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
    briefScorePill: {
      flexShrink: 0,
      minWidth: 34,
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    briefScorePillHot: {
      backgroundColor: theme.accentOrange + '22',
      borderColor: theme.accentOrange + '88',
    },
    briefScorePillQuiet: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.border,
    },
    briefScoreText: {
      fontSize: sf(11),
      fontWeight: '900',
      color: theme.text,
    },
    briefScoreTextHot: {
      color: theme.accentOrange,
    },
    briefScoreTextQuiet: {
      color: theme.textMuted,
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
