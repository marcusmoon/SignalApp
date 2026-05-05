import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketSnapshotSection } from '@/components/summary/MarketSnapshotSection';
import { OtaUpdateBanner } from '@/components/OtaUpdateBanner';
import { SignalLoadingIndicator } from '@/components/signal/SignalLoadingIndicator';
import type { AppTheme } from '@/constants/theme';
import { useLocale } from '@/contexts/LocaleContext';
import { useSignalTheme } from '@/contexts/SignalThemeContext';
import { fetchCompanyNewsForDisplay } from '@/services/companyNewsForSymbol';
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
  SignalApiStockCandles,
} from '@/integrations/signal-api/types';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';
import { fetchSignalStockCandles } from '@/integrations/signal-api/stock';
import { buildSignalScore, type SignalScore } from '@/domain/signals';
import { loadMarketSnapshotQuotes } from '@/services/marketSnapshotQuotes';
import { loadWatchlistSymbols } from '@/services/quoteWatchlist';
import { hasSignalApi } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';
import { signalQuoteMovePct, signalReasonLabel } from '@/utils/signalDisplay';

const WATCH_LIMIT = 10;
const EARN_DAYS = 21;
const MACRO_DAYS = 7;
const CANDLE_LOOKBACK_DAYS = 70;
const NEWS_DENSE_MIN = 4;

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatPctOne(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
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

function insightVsSma20(candles: SignalApiStockCandles, lastPrice: number): { vsSmaPct: number } | null {
  const { c, t } = candles;
  if (!Array.isArray(c) || !Array.isArray(t) || c.length !== t.length || c.length < 20) return null;
  const ordered = t
    .map((unix, i) => ({ unix, close: c[i]! }))
    .sort((a, b) => a.unix - b.unix)
    .map((x) => x.close);
  const last20 = ordered.slice(-20);
  const sma = last20.reduce((a, b) => a + b, 0) / 20;
  if (!Number.isFinite(sma) || sma === 0 || !Number.isFinite(lastPrice)) return null;
  return { vsSmaPct: ((lastPrice - sma) / sma) * 100 };
}

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
  const [smaBySymbol, setSmaBySymbol] = useState<Record<string, { vsSmaPct: number } | null>>({});

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
      setSmaBySymbol({});
      return;
    }
    setError(null);
    const watch = (await loadWatchlistSymbols()).map((s) => s.trim().toUpperCase()).filter(Boolean);
    const syms = watch.slice(0, WATCH_LIMIT);
    setSymbols(syms);

    const today = startOfLocalDay(new Date());
    const earnUntil = addDays(today, EARN_DAYS);
    const macroUntil = addDays(today, MACRO_DAYS);
    const candleFrom = addDays(today, -CANDLE_LOOKBACK_DAYS);
    const candleTo = new Date();

    const [snap, mqRows, earnRows, newsLists, econRows] = await Promise.all([
      loadMarketSnapshotQuotes().catch(() => ({ tape: {} as Record<string, SignalApiMarketQuote | null>, macro: {} })),
      syms.length > 0
        ? fetchSignalMarketQuotes({ symbols: syms, pageSize: Math.max(syms.length, 1) }).catch(() => [])
        : Promise.resolve([]),
      fetchSignalEarningsCalendarRangeMerged(today, earnUntil).catch(() => [] as SignalApiCalendarEvent[]),
      Promise.all(syms.map((sym) => fetchCompanyNewsForDisplay(sym, locale).catch(() => [] as SignalApiNewsItem[]))),
      fetchSignalMacroCalendarRangeMerged(today, macroUntil).catch(() => [] as SignalApiCalendarEvent[]),
    ]);

    setTape(snap.tape);
    setMacro(snap.macro);

    const qRows = syms.map((sym) => {
      const row = mqRows.find((r) => String(r.symbol || '').trim().toUpperCase() === sym);
      if (!row) return { symbol: sym, q: null };
      return { symbol: sym, q: signalMarketQuoteHasValidPrice(row) ? row : null };
    });
    setQuotes(qRows);

    const watchSet = new Set(syms);
    setEarnings(
      earnRows
        .filter((r) => earningsRowSymbol(r) && watchSet.has(earningsRowSymbol(r)))
        .sort((a, b) => earningsRowDate(a).localeCompare(earningsRowDate(b))),
    );

    const nb: Record<string, SignalApiNewsItem[]> = {};
    syms.forEach((sym, i) => {
      nb[sym] = newsLists[i] ?? [];
    });
    setNewsBySymbol(nb);

    const econSorted = [...econRows].sort((a, b) => {
      const ka = String(a.eventAt || a.date || '');
      const kb = String(b.eventAt || b.date || '');
      return ka.localeCompare(kb);
    });
    setEconomicWeek(econSorted);

    let smaOut: Record<string, { vsSmaPct: number } | null> = {};
    if (syms.length > 0) {
      const pairs = await Promise.all(
        syms.map((sym, i) => {
          const q = qRows[i]?.q ?? null;
          return fetchSignalStockCandles(sym, 'D', candleFrom, candleTo)
            .then((candles): [string, { vsSmaPct: number } | null] => {
              if (!candles || !q || !signalMarketQuoteHasValidPrice(q)) return [sym, null];
              const last = Number(q.currentPrice);
              return [sym, insightVsSma20(candles, last)];
            })
            .catch((): [string, null] => [sym, null]);
        }),
      );
      smaOut = Object.fromEntries(pairs);
    }
    setSmaBySymbol(smaOut);
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
          vsSmaPct: smaBySymbol[sym]?.vsSmaPct ?? null,
          todayYmd,
        }),
      )
      .sort((a, b) => b.score - a.score || b.newsCount - a.newsCount || a.symbol.localeCompare(b.symbol))
      .slice(0, 20);
  }, [earnings, newsBySymbol, quoteBySymbol, smaBySymbol, symbols]);

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
              <Text style={styles.digestKicker}>{t('briefingDigestKicker')}</Text>
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

          {!error ? <MarketSnapshotSection tape={tape} macro={macro} /> : null}

          {!error ? (
            <>
              {signalRows.length > 0 ? (
                <>
                  <Text style={[styles.blockTitle, styles.sectionHeading]}>{t('briefingTodaySignalsTitle')}</Text>
                  <View style={styles.signalBoard}>
                    {signalRows.map((row: SignalScore, index) => {
                      const q = quoteBySymbol[row.symbol] ?? null;
                      const dp = signalQuoteMovePct(q);
                      const up = (Number.isFinite(dp) ? dp : 0) >= 0;
                      const reasons = row.reasons.slice(0, 2).map((r) => signalReasonLabel(r, t));
                      if (reasons.length === 0) reasons.push(t('signalReasonWatch'));
                      return (
                        <Pressable
                          key={`signal-${row.symbol}`}
                          style={[
                            styles.signalRow,
                            row.level === 'hot' && styles.signalRowHot,
                            row.level === 'quiet' && styles.signalRowQuiet,
                          ]}
                          onPress={() => router.push(`/symbol/${row.symbol}`)}
                          accessibilityRole="button"
                          accessibilityLabel={t('briefingSignalOpenA11y', {
                            symbol: row.symbol,
                            score: String(row.score),
                          })}>
                          <Text style={styles.signalRank}>{index + 1}</Text>
                          <View style={styles.signalMain}>
                            <View style={styles.signalTitleRow}>
                              <Text style={styles.signalSymbol}>{row.symbol}</Text>
                              <Text style={[styles.signalMove, up ? styles.up : styles.dn]}>
                                {q ? formatPct(dp) : '—'}
                              </Text>
                            </View>
                            <Text style={styles.signalReasons} numberOfLines={1}>
                              {reasons.join(' · ')}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.signalScorePill,
                              row.level === 'hot' && styles.signalScoreHot,
                              row.level === 'quiet' && styles.signalScoreQuiet,
                            ]}>
                            <Text
                              style={[
                                styles.signalScoreText,
                                row.level === 'hot' && styles.signalScoreTextHot,
                                row.level === 'quiet' && styles.signalScoreTextQuiet,
                              ]}>
                              {row.score}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {symbols.length > 0 ? (
                <>
                  <Text style={[styles.blockTitle, styles.sectionHeading]}>{t('briefingSectionInsights')}</Text>
                  <Text style={styles.sectionHint}>{t('briefingSectionInsightsHint')}</Text>
                  {notableSymbols.map((sym) => {
                    const q = quoteBySymbol[sym] ?? null;
                    const list = newsBySymbol[sym] ?? [];
                    const topNews = list[0];
                    const nextE = nextEarningForSymbol(earnings, sym);
                    const dp = signalQuoteMovePct(q);
                    const up = (Number.isFinite(dp) ? dp : 0) >= 0;
                    const sma = smaBySymbol[sym];
                    const vsLine =
                      sma && Number.isFinite(sma.vsSmaPct)
                        ? t('briefingRowVsSma', { pct: formatPctOne(sma.vsSmaPct) })
                        : t('briefingRowVsSmaUnknown');
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
                    const primaryStory = headline || (earnLine !== noEarn ? earnLine : vsLine);
                    const subMeta: string[] = [];
                    if (headline) {
                      subMeta.push(vsLine);
                      if (earnLine !== noEarn) subMeta.push(earnLine);
                    } else if (earnLine !== noEarn) {
                      subMeta.push(vsLine);
                    }

                    return (
                      <Pressable
                        key={sym}
                        style={styles.briefCard}
                        onPress={() => router.push(`/symbol/${sym}`)}
                        accessibilityRole="button"
                        accessibilityLabel={`${sym} ${primaryStory}`}>
                        <View style={styles.briefCardHead}>
                          <Text style={styles.briefCardSym} numberOfLines={1}>
                            {sym}
                          </Text>
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

              <Text style={[styles.blockTitle, styles.sectionHeading]}>{t('briefingWeekEarningsTitle')}</Text>
              {weekEarnings.length === 0 ? (
                <Text style={styles.weekStripEmpty}>{t('briefingWeekEarningsEmpty')}</Text>
              ) : (
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.weekStripScroll}>
                  {weekEarnings.map((r) => (
                    <Pressable
                      key={`${earningsRowSymbol(r)}-${earningsRowDate(r)}-${earningsRowQuarter(r)}-${earningsRowYear(r)}`}
                      style={styles.weekChip}
                      onPress={() => router.push(`/symbol/${earningsRowSymbol(r)}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${earningsRowSymbol(r)} ${earningsRowDate(r)}`}>
                      <Text style={styles.weekChipDate}>{shortMd(earningsRowDate(r))}</Text>
                      <Text style={styles.weekChipSym} numberOfLines={1}>
                        {earningsRowSymbol(r)}
                      </Text>
                      <Text style={styles.weekChipMeta} numberOfLines={1}>
                        {t('fiscalYearQuarterShort', { y: earningsRowYear(r), q: earningsRowQuarter(r) })}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}

              <Text style={[styles.blockTitle, styles.sectionHeading]}>{t('briefingSectionMacroWeek')}</Text>
              {macroDisplay.length === 0 ? (
                <Text style={styles.macroEmpty}>{t('briefingMacroEmpty')}</Text>
              ) : (
                <View style={styles.macroCard}>
                  {macroDisplay.map((r, idx) => (
                    <View
                      key={`${r.id}-${idx}`}
                      style={[styles.macroRow, idx === macroDisplay.length - 1 && styles.macroRowLast]}>
                      <Text style={styles.macroMeta} numberOfLines={1}>
                        {r.country || '—'} · {macroEventTimeLabel(r)}
                        {r.impact?.toLowerCase() === 'high' ? ` · ${t('briefingMacroImpactHigh')}` : ''}
                      </Text>
                      <Text style={styles.macroEvent} numberOfLines={2}>
                        {r.title}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function makeStyles(theme: AppTheme, sf: (n: number) => number) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    content: { paddingHorizontal: 16, paddingTop: 10 },
    digestWrap: {
      marginBottom: 14,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    digestKicker: {
      fontSize: sf(10),
      fontWeight: '800',
      letterSpacing: 1.2,
      color: theme.green,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    digestHeadline: {
      fontSize: sf(18),
      fontWeight: '800',
      color: theme.text,
      lineHeight: sf(24),
      letterSpacing: -0.3,
    },
    digestMore: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    digestMoreLine: { fontSize: sf(12), fontWeight: '600', color: theme.textDim, lineHeight: sf(18) },
    digestMoreLineGap: { marginTop: 8 },
    muted: { fontSize: sf(12), color: theme.textDim, marginTop: 4, marginBottom: 12 },
    blockTitle: {
      fontSize: sf(11),
      fontWeight: '800',
      letterSpacing: 0.2,
      color: theme.textMuted,
      marginTop: 4,
      marginBottom: 6,
    },
    sectionHeading: { marginTop: 14 },
    sectionHint: {
      fontSize: sf(11),
      color: theme.textDim,
      fontWeight: '600',
      lineHeight: sf(16),
      marginTop: -2,
      marginBottom: 8,
    },
    macroCard: {
      marginBottom: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    macroEmpty: {
      fontSize: sf(11),
      color: theme.textDim,
      marginBottom: 10,
      lineHeight: sf(16),
    },
    macroRow: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    macroRowLast: { borderBottomWidth: 0 },
    macroMeta: { fontSize: sf(10), fontWeight: '700', color: theme.textMuted, marginBottom: 4 },
    macroEvent: { fontSize: sf(12), fontWeight: '600', color: theme.text, lineHeight: sf(16) },
    weekStripEmpty: {
      fontSize: sf(11),
      color: theme.textDim,
      marginBottom: 10,
      lineHeight: sf(16),
    },
    weekStripScroll: {
      paddingBottom: 10,
      gap: 8,
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    weekChip: {
      width: Math.round(sf(108)),
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 10,
      backgroundColor: theme.bgElevated,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 8,
    },
    weekChipDate: {
      fontSize: sf(10),
      fontWeight: '700',
      color: theme.textMuted,
      marginBottom: 4,
    },
    weekChipSym: { fontSize: sf(13), fontWeight: '800', color: theme.green, marginBottom: 2 },
    weekChipMeta: { fontSize: sf(10), color: theme.textDim },
    briefCard: {
      marginBottom: 10,
      padding: 14,
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    briefCardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    briefCardSym: {
      flex: 1,
      minWidth: 0,
      fontSize: sf(15),
      fontWeight: '800',
      color: theme.green,
    },
    briefCardValues: { flexDirection: 'row', alignItems: 'center', flexShrink: 0, gap: 8 },
    briefCardPrice: { fontSize: sf(14), fontWeight: '700', color: theme.text, minWidth: 56, textAlign: 'right' },
    briefCardPct: { fontSize: sf(13), fontWeight: '700', minWidth: 56, textAlign: 'right' },
    up: { color: theme.green },
    dn: { color: '#ff6b6b' },
    briefCardStory: {
      fontSize: sf(13),
      fontWeight: '600',
      color: theme.text,
      lineHeight: sf(19),
    },
    briefCardMeta: {
      marginTop: 6,
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
    signalBoard: {
      borderRadius: 14,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 10,
      overflow: 'hidden',
    },
    signalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    signalRowHot: {
      backgroundColor: theme.accentOrange + '10',
      borderLeftWidth: 3,
      borderLeftColor: theme.accentOrange,
    },
    signalRowQuiet: {
      backgroundColor: theme.bgElevated + '66',
    },
    signalRank: { width: 20, fontSize: sf(11), fontWeight: '900', color: theme.textMuted, textAlign: 'center' },
    signalMain: { flex: 1, minWidth: 0 },
    signalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    signalSymbol: { fontSize: sf(14), fontWeight: '900', color: theme.text },
    signalMove: { fontSize: sf(12), fontWeight: '800' },
    signalReasons: { fontSize: sf(11), color: theme.textDim, fontWeight: '600' },
    signalScorePill: {
      minWidth: 38,
      alignItems: 'center',
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: theme.greenDim,
      borderWidth: 1,
      borderColor: theme.greenBorder,
    },
    signalScoreHot: {
      backgroundColor: theme.accentOrange + '22',
      borderColor: theme.accentOrange + '88',
    },
    signalScoreQuiet: {
      backgroundColor: theme.bgElevated,
      borderColor: theme.border,
    },
    signalScoreText: { fontSize: sf(12), fontWeight: '900', color: theme.text },
    signalScoreTextHot: { color: theme.accentOrange },
    signalScoreTextQuiet: { color: theme.textMuted },
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
