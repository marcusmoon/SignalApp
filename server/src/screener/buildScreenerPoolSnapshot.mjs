/**
 * Build KR screener pool snapshot — single job path.
 *
 * Flow: universe (venues) → Yahoo quotes + 2y bars → RSI / turnover / momentum
 * → screener_snapshots only. Does not read or write app market_quotes / price_series.
 *
 * History depth: return12m needs 253 closes; ma200/alignedMa need 200.
 * Yahoo `1y` sits on that edge — pool uses `2y` (~500 sessions).
 */
import { queryKysely } from '../db/kysely/client.mjs';
import { fetchYahooDailyPriceSeries } from '../providers/market/yahooDailyBars.mjs';
import { fetchYahooKrxMarketQuotes } from '../providers/market/yahooKrxQuotes.mjs';
import {
  koreaScreenerVenueMap,
  preferredYahooFromVenues,
  venuesFromMarketListPayload,
  yahooSymbolForVenue,
} from './koreaScreenerUniverse.mjs';
import { normalizeScreenerMarket } from './markets.mjs';
import { computeMomentumMetrics } from './momentum.mjs';
import {
  buildPoolPolicy,
  SCREENER_DAILY_BAR_RANGE,
  SCREENER_MIN_BARS_FOR_RETURN12M,
  SCREENER_RSI_PERIOD,
} from './policy.mjs';
import { computeRsi } from './rsi.mjs';
import { shouldExcludeFromKrUniverse } from './universeExclude.mjs';

export {
  buildPoolPolicy,
  SCREENER_DAILY_BAR_RANGE,
  SCREENER_MIN_BARS_FOR_RETURN12M,
  SCREENER_RSI_PERIOD,
} from './policy.mjs';

function cleanText(value) {
  return String(value || '').trim();
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeKrCode(value) {
  const raw = cleanText(value).replace(/\.(KS|KQ)$/i, '');
  return /^\d{6}$/.test(raw) ? raw : '';
}

function emptyPoolSnapshot(market, note) {
  const asOf = new Date().toISOString();
  return {
    id: `screener-snapshot:${market}:${asOf}`,
    market,
    generatedAt: asOf,
    generatedDate: asOf.slice(0, 10),
    asOf,
    publishedAt: asOf,
    locale: market === 'kr' ? 'ko' : 'en',
    universe: { asOf, size: 0, source: 'none', note },
    policy: buildPoolPolicy(market),
    symbols: [],
    createdAt: asOf,
    updatedAt: asOf,
  };
}

async function loadUniverse() {
  const result = await queryKysely(
    `SELECT payload FROM market_lists WHERE list_key = 'korea_screener_universe' LIMIT 1`,
    [],
  );
  const payload = result.rows[0]?.payload || null;
  const symbols = (Array.isArray(payload?.symbols) ? payload.symbols : [])
    .map(normalizeKrCode)
    .filter(Boolean);
  const venues = venuesFromMarketListPayload(payload);
  // Code fallback if DB seed lacks venues (pre-V4).
  for (const [symbol, venue] of koreaScreenerVenueMap()) {
    if (!venues.has(symbol)) venues.set(symbol, venue);
  }
  if (!symbols.length) {
    const fallback = [...koreaScreenerVenueMap().keys()];
    return { symbols: fallback, venues, source: 'korea_screener_universe_code' };
  }
  return { symbols, venues, source: 'korea_screener_universe' };
}

async function fetchUniverseQuotes(symbols, venues) {
  if (!symbols.length) return new Map();
  const venueBySymbol = Object.fromEntries(
    symbols.map((symbol) => [symbol, venues.get(symbol) || 'kospi']),
  );
  const rows = await fetchYahooKrxMarketQuotes({
    symbols,
    segment: 'korea',
    venueBySymbol,
    preferredYahooBySymbol: preferredYahooFromVenues(new Map(Object.entries(venueBySymbol))),
    concurrency: 4,
  });
  const map = new Map();
  for (const row of rows) {
    const code = normalizeKrCode(row.krxSymbol || row.symbol);
    if (code) map.set(code, row);
  }
  return map;
}

async function fetchUniverseBars(symbols, venues, range = SCREENER_DAILY_BAR_RANGE) {
  if (!symbols.length) return new Map();
  const instruments = symbols.map((symbol) => {
    const venue = venues.get(symbol) || 'kospi';
    return {
      symbol,
      displaySymbol: symbol,
      name: symbol,
      currency: 'KRW',
      yahooSymbol: yahooSymbolForVenue(symbol, venue),
    };
  });
  const seriesRows = await fetchYahooDailyPriceSeries({
    instruments,
    range,
    requestDelayMs: 60,
  });
  const map = new Map();
  for (const row of seriesRows) {
    const code = normalizeKrCode(row.krxSymbol || row.symbol);
    if (code) map.set(code, row);
  }
  return map;
}

function barCountStats(barsBySymbol) {
  const counts = [];
  for (const row of barsBySymbol.values()) {
    const n = Array.isArray(row?.bars) ? row.bars.length : 0;
    if (n > 0) counts.push(n);
  }
  if (!counts.length) {
    return { barCountMin: null, barCountMax: null, barCountMedian: null, barsGe253: 0 };
  }
  counts.sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median =
    counts.length % 2 === 0 ? Math.round((counts[mid - 1] + counts[mid]) / 2) : counts[mid];
  return {
    barCountMin: counts[0],
    barCountMax: counts[counts.length - 1],
    barCountMedian: median,
    barsGe253: counts.filter((n) => n >= SCREENER_MIN_BARS_FOR_RETURN12M).length,
  };
}

function metricsFromBars(seriesRow) {
  const bars = Array.isArray(seriesRow?.bars) ? seriesRow.bars : [];
  const closes = bars.map((b) => numOrNull(b?.close)).filter((n) => n != null);
  const rsi = computeRsi(closes, SCREENER_RSI_PERIOD);
  let lastVolume = null;
  for (let i = bars.length - 1; i >= 0; i--) {
    const v = numOrNull(bars[i]?.volume);
    if (v != null && v > 0) {
      lastVolume = v;
      break;
    }
  }
  return {
    rsi,
    lastVolume,
    momentum: computeMomentumMetrics(bars),
  };
}

function rankRows(list) {
  return [...list].sort((a, b) => {
    const capA = a.marketCap;
    const capB = b.marketCap;
    if (capA != null && capB != null && capA !== capB) return capB - capA;
    if (capA != null && capB == null) return -1;
    if (capA == null && capB != null) return 1;
    return a.listRank - b.listRank;
  });
}

async function buildKrPoolSnapshot(options = {}) {
  const dailyBarRange =
    cleanText(options.dailyBarRange || options.range) || SCREENER_DAILY_BAR_RANGE;
  const { symbols: universeSymbols, venues, source } = await loadUniverse();
  const quotes = await fetchUniverseQuotes(universeSymbols, venues);
  const barsBySymbol = await fetchUniverseBars(universeSymbols, venues, dailyBarRange);
  const barStats = barCountStats(barsBySymbol);

  const listRank = new Map(universeSymbols.map((s, i) => [s, i + 1]));
  const rows = [];
  let excludedCount = 0;

  for (const symbol of universeSymbols) {
    const quote = quotes.get(symbol) || null;
    const series = barsBySymbol.get(symbol) || null;
    const name = cleanText(quote?.name) || cleanText(series?.name) || symbol;
    const exclusion = shouldExcludeFromKrUniverse({ symbol, name, quote });
    if (exclusion.exclude) {
      excludedCount += 1;
      continue;
    }

    const venue = venues.get(symbol) || 'kospi';
    const yahooSymbol =
      yahooSymbolForVenue(symbol, venue) ||
      cleanText(quote?.yahooSymbol) ||
      null;
    const { rsi, lastVolume, momentum } = metricsFromBars(series);

    const price = numOrNull(quote?.currentPrice);
    let turnoverKrw = numOrNull(quote?.turnoverKrw);
    if (turnoverKrw == null) {
      const vol = numOrNull(quote?.volume ?? quote?.dayVolume) ?? lastVolume;
      if (price != null && vol != null && vol > 0) turnoverKrw = Math.round(price * vol);
    }

    rows.push({
      symbol,
      yahooSymbol,
      name,
      market: venue,
      marketCap:
        numOrNull(quote?.marketCapitalization) ?? numOrNull(quote?.marketCap),
      listRank: listRank.get(symbol) ?? 10_000,
      currentPrice: price,
      changePercent: numOrNull(quote?.changePercent),
      per: null,
      pbr: null,
      revenueYoY: null,
      operatingProfitYoY: null,
      netProfitYoY: null,
      dividend: null,
      dividendGrowthCapacity: null,
      turnoverKrw,
      rsi,
      return3m: momentum.return3m,
      return6m: momentum.return6m,
      return12m: momentum.return12m,
      ma20: momentum.ma20,
      ma60: momentum.ma60,
      ma120: momentum.ma120,
      ma200: momentum.ma200,
      alignedMa: momentum.alignedMa,
      pctFrom52wHigh: momentum.pctFrom52wHigh,
      volumeRatio: momentum.volumeRatio,
      foreignNetBuy: null,
      institutionNetBuy: null,
    });
  }

  const kospi = rankRows(rows.filter((r) => r.market === 'kospi')).slice(0, 30);
  const kosdaq = rankRows(rows.filter((r) => r.market === 'kosdaq')).slice(0, 50);
  let universeRows = [...kospi, ...kosdaq];
  if (universeRows.length < 40) {
    const picked = new Set(universeRows.map((r) => r.symbol));
    for (const row of rankRows(rows)) {
      if (picked.has(row.symbol)) continue;
      universeRows.push(row);
      picked.add(row.symbol);
      if (universeRows.length >= 80) break;
    }
  }

  const asOf = new Date().toISOString();
  const generatedDate = asOf.slice(0, 10);
  const symbols = universeRows.map((row, index) => {
    const { marketCap: _mc, listRank: _lr, ...rest } = row;
    return {
      id: `screener-pool:kr:${generatedDate}:${row.symbol}`,
      ...rest,
      universeRank: index + 1,
      passed: false,
      note: '',
      aiGenerated: false,
    };
  });

  return {
    id: `screener-snapshot:kr:${asOf}`,
    market: 'kr',
    generatedAt: asOf,
    generatedDate,
    asOf,
    publishedAt: asOf,
    locale: 'ko',
    universe: {
      kospiTop: 30,
      kosdaqTop: 50,
      size: symbols.length,
      asOf,
      source,
      excludedCount,
      quoteFetched: quotes.size,
      seriesFetched: barsBySymbol.size,
      dailyBarRange,
      ...barStats,
      note:
        `One job: Yahoo quotes + ${dailyBarRange} bars → screener_snapshots. Need ≥${SCREENER_MIN_BARS_FOR_RETURN12M} closes for return12m/ma200 accuracy. No app quotes/price_series dependency.`,
    },
    policy: buildPoolPolicy('kr'),
    symbols,
    createdAt: asOf,
    updatedAt: asOf,
  };
}

/**
 * @param {{ market?: string, dailyBarRange?: string, range?: string }} [options]
 */
export async function buildScreenerPoolSnapshot(options = {}) {
  const market = normalizeScreenerMarket(options.market);
  if (market === 'kr') return buildKrPoolSnapshot(options);
  return emptyPoolSnapshot(
    market,
    `Pool builder for market=${market} is not wired yet.`,
  );
}

/** @deprecated Use buildScreenerPoolSnapshot */
export const buildScreenerPoolSnapshotFromDb = buildScreenerPoolSnapshot;
