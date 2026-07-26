/**
 * Build a per-market screener pool snapshot (shared universe/metrics).
 * All curation methods for that market read the same pool.
 *
 * Null policy: calculation failures stay null — never coerce to 0.
 * (0 YoY means flat growth; inventing 0 would falsely pass/fail filters.)
 *
 * Fundamentals (PER/PBR/YoY/dividend) stay null unless present on quote payload.
 *
 * Self-backfill: when DB quotes/price_series are sparse, this job fetches Yahoo
 * for missing universe symbols so the pool does not wait on other job cycles.
 */
import { upsertCollectionRows } from '../db.mjs';
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
import { buildPoolPolicy, SCREENER_RSI_PERIOD } from './policy.mjs';
import { computeRsi } from './rsi.mjs';
import { shouldExcludeFromKrUniverse } from './universeExclude.mjs';

export { buildPoolPolicy, SCREENER_RSI_PERIOD } from './policy.mjs';

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

function yahooFromVenue(symbol, venue) {
  const code = normalizeKrCode(symbol);
  if (!code) return null;
  return venue === 'kosdaq' ? `${code}.KQ` : `${code}.KS`;
}

function venueFromYahooHint(yahooSymbol, quoteMarket) {
  const hint = cleanText(quoteMarket || yahooSymbol).toUpperCase();
  if (hint.includes('.KQ') || hint === 'KOSDAQ') return 'kosdaq';
  if (hint.includes('.KS') || hint === 'KOSPI') return 'kospi';
  return 'kospi';
}

function barsFromPriceSeriesPayload(payload) {
  return Array.isArray(payload?.bars)
    ? payload.bars
    : Array.isArray(payload?.candles)
      ? payload.candles
      : Array.isArray(payload?.daily)
        ? payload.daily
        : [];
}

function closesFromPriceSeriesPayload(payload) {
  const closes = [];
  for (const bar of barsFromPriceSeriesPayload(payload)) {
    const c = numOrNull(bar?.c ?? bar?.close ?? bar?.Close);
    if (c != null) closes.push(c);
  }
  return closes;
}

/** Last bar volume (shares) — never invent 0. */
function lastVolumeFromPriceSeriesPayload(payload) {
  const bars = barsFromPriceSeriesPayload(payload);
  for (let i = bars.length - 1; i >= 0; i--) {
    const v = numOrNull(bars[i]?.v ?? bars[i]?.volume ?? bars[i]?.Volume);
    if (v != null && v > 0) return v;
  }
  return null;
}

async function loadMarketListPayload(listKey) {
  const result = await queryKysely(
    `SELECT payload FROM market_lists WHERE list_key = $1 LIMIT 1`,
    [listKey],
  );
  return result.rows[0]?.payload || null;
}

/** Prefer screener universe (~80); fall back to korea_watchlist. */
async function loadKoreaUniverseSymbols() {
  const screenerPayload = await loadMarketListPayload('korea_screener_universe');
  const screener = Array.isArray(screenerPayload?.symbols)
    ? screenerPayload.symbols.map(normalizeKrCode).filter(Boolean)
    : [];
  if (screener.length) {
    const venues = venuesFromMarketListPayload(screenerPayload);
    // Code fallback if DB still on pre-V4 seed without venues.
    const fallback = koreaScreenerVenueMap();
    for (const [symbol, venue] of fallback) {
      if (!venues.has(symbol)) venues.set(symbol, venue);
    }
    return { symbols: screener, source: 'korea_screener_universe', venues };
  }
  const watchlistPayload = await loadMarketListPayload('korea_watchlist');
  const watchlist = Array.isArray(watchlistPayload?.symbols)
    ? watchlistPayload.symbols.map(normalizeKrCode).filter(Boolean)
    : [];
  return { symbols: watchlist, source: 'korea_watchlist', venues: new Map() };
}

async function loadKoreaQuotes() {
  const result = await queryKysely(
    `
      SELECT payload
      FROM market_quotes
      WHERE segment = 'korea'
      ORDER BY fetched_at DESC NULLS LAST
      LIMIT 400
    `,
    [],
  );
  const bySymbol = new Map();
  for (const row of result.rows) {
    const p = row.payload;
    if (!p || typeof p !== 'object') continue;
    const symbol = normalizeKrCode(p.krxSymbol || p.displaySymbol || p.symbol);
    if (!symbol || bySymbol.has(symbol)) continue;
    bySymbol.set(symbol, p);
  }
  return bySymbol;
}

function applySeriesPayloadMetrics(code, payload, { rsiBySymbol, volumeBySymbol, momentumBySymbol }) {
  if (!code || !payload) return;
  const bars = barsFromPriceSeriesPayload(payload);
  if (!rsiBySymbol.has(code)) {
    const closes = closesFromPriceSeriesPayload(payload);
    const rsi = computeRsi(closes, SCREENER_RSI_PERIOD);
    if (rsi != null) rsiBySymbol.set(code, rsi);
  }
  if (!volumeBySymbol.has(code)) {
    const vol = lastVolumeFromPriceSeriesPayload(payload);
    if (vol != null) volumeBySymbol.set(code, vol);
  }
  if (bars.length) {
    const metrics = computeMomentumMetrics(bars);
    const prev = momentumBySymbol.get(code);
    // Prefer complete (1y) metrics over short-series nulls.
    if (!prev || !momentumNeedsBackfill(metrics) || momentumNeedsBackfill(prev)) {
      momentumBySymbol.set(code, metrics);
    }
  }
}

async function loadSeriesMetricsBySymbol(symbols) {
  const rsiBySymbol = new Map();
  const volumeBySymbol = new Map();
  const momentumBySymbol = new Map();
  if (!symbols.length) return { rsiBySymbol, volumeBySymbol, momentumBySymbol };
  const upper = symbols.map((s) => s.toUpperCase());
  const result = await queryKysely(
    `
      SELECT symbol, display_symbol, yahoo_symbol, payload
      FROM price_series
      WHERE upper(COALESCE(display_symbol, '')) = ANY($1::text[])
         OR upper(COALESCE(symbol, '')) = ANY($1::text[])
         OR regexp_replace(upper(COALESCE(yahoo_symbol, '')), '\\.(KS|KQ)$', '') = ANY($1::text[])
         OR upper(COALESCE(payload->>'krxSymbol', '')) = ANY($1::text[])
      LIMIT 400
    `,
    [upper],
  );
  for (const row of result.rows) {
    const code =
      normalizeKrCode(row.payload?.krxSymbol) ||
      normalizeKrCode(row.display_symbol) ||
      normalizeKrCode(row.yahoo_symbol) ||
      normalizeKrCode(row.symbol);
    applySeriesPayloadMetrics(code, row.payload || row, {
      rsiBySymbol,
      volumeBySymbol,
      momentumBySymbol,
    });
  }
  return { rsiBySymbol, volumeBySymbol, momentumBySymbol };
}

function metricFromQuote(quote, key) {
  const payload = quote?.payload && typeof quote.payload === 'object' ? quote.payload : quote;
  return numOrNull(
    payload?.[key] ??
      payload?.metrics?.[key] ??
      payload?.fundamentals?.[key] ??
      payload?.rawPayload?.[key],
  );
}

function boolFromQuote(quote, key) {
  const payload = quote?.payload && typeof quote.payload === 'object' ? quote.payload : quote;
  const v = payload?.[key] ?? payload?.metrics?.[key] ?? payload?.fundamentals?.[key];
  if (typeof v === 'boolean') return v;
  return null;
}

/** Money-flow slots stay null until a dedicated feed exists. */
function moneyFlowSlots() {
  return {
    foreignNetBuy: null,
    institutionNetBuy: null,
  };
}

function momentumSlotsOrEmpty(metrics) {
  return {
    return3m: metrics?.return3m ?? null,
    return6m: metrics?.return6m ?? null,
    return12m: metrics?.return12m ?? null,
    ma20: metrics?.ma20 ?? null,
    ma60: metrics?.ma60 ?? null,
    ma120: metrics?.ma120 ?? null,
    ma200: metrics?.ma200 ?? null,
    alignedMa: typeof metrics?.alignedMa === 'boolean' ? metrics.alignedMa : null,
    pctFrom52wHigh: metrics?.pctFrom52wHigh ?? null,
    volumeRatio: metrics?.volumeRatio ?? null,
    ...moneyFlowSlots(),
  };
}

function momentumNeedsBackfill(metrics) {
  if (!metrics) return true;
  // Short series leave ma200/return12m null — refetch 1y bars.
  return metrics.ma200 == null || metrics.return12m == null;
}

function emptyPoolSnapshot(market, note) {
  const asOf = new Date().toISOString();
  const generatedDate = asOf.slice(0, 10);
  return {
    id: `screener-snapshot:${market}:${asOf}`,
    market,
    generatedAt: asOf,
    generatedDate,
    asOf,
    publishedAt: asOf,
    locale: market === 'kr' ? 'ko' : 'en',
    universe: {
      asOf,
      size: 0,
      source: 'none',
      note,
    },
    policy: buildPoolPolicy(market),
    symbols: [],
    createdAt: asOf,
    updatedAt: asOf,
  };
}

function quoteNeedsBackfill(quote) {
  if (!quote) return true;
  const price = numOrNull(quote.currentPrice);
  const volume = numOrNull(quote.volume ?? quote.dayVolume);
  const turnover = numOrNull(quote.turnoverKrw);
  return price == null || (volume == null && turnover == null);
}

async function backfillMissingQuotes(universeSymbols, seedVenues, quotes) {
  const missing = universeSymbols.filter((symbol) => quoteNeedsBackfill(quotes.get(symbol)));
  if (!missing.length) return { fetched: 0 };
  const venueBySymbol = Object.fromEntries(
    missing.map((symbol) => [symbol, seedVenues.get(symbol) || 'kospi']),
  );
  const rows = await fetchYahooKrxMarketQuotes({
    symbols: missing,
    segment: 'korea',
    venueBySymbol,
    preferredYahooBySymbol: preferredYahooFromVenues(
      new Map(Object.entries(venueBySymbol)),
    ),
    concurrency: 4,
  });
  for (const row of rows) {
    const code = normalizeKrCode(row.krxSymbol || row.symbol);
    if (!code) continue;
    quotes.set(code, row);
  }
  if (rows.length) {
    try {
      await upsertCollectionRows('marketQuotes', rows);
    } catch (error) {
      console.warn('[screener_pool] quote backfill persist failed', error?.message || error);
    }
  }
  return { fetched: rows.length, requested: missing.length };
}

async function backfillMissingSeriesMetrics(
  universeSymbols,
  seedVenues,
  { rsiBySymbol, volumeBySymbol, momentumBySymbol },
) {
  // Need ~252 bars for return12m / ma200 — fetch 1y when RSI/momentum incomplete.
  const missing = universeSymbols.filter(
    (symbol) => !rsiBySymbol.has(symbol) || momentumNeedsBackfill(momentumBySymbol.get(symbol)),
  );
  if (!missing.length) return { fetched: 0 };
  const instruments = missing.map((symbol) => {
    const venue = seedVenues.get(symbol) || 'kospi';
    const yahooSymbol = yahooSymbolForVenue(symbol, venue);
    return {
      symbol,
      displaySymbol: symbol,
      name: symbol,
      currency: 'KRW',
      yahooSymbol,
    };
  });
  const seriesRows = await fetchYahooDailyPriceSeries({
    instruments,
    range: '1y',
    requestDelayMs: 60,
  });
  for (const row of seriesRows) {
    const code = normalizeKrCode(row.krxSymbol || row.symbol);
    if (!code) continue;
    applySeriesPayloadMetrics(code, row, { rsiBySymbol, volumeBySymbol, momentumBySymbol });
  }
  if (seriesRows.length) {
    try {
      await upsertCollectionRows('priceSeries', seriesRows);
    } catch (error) {
      console.warn('[screener_pool] price_series backfill persist failed', error?.message || error);
    }
  }
  return { fetched: seriesRows.length, requested: missing.length };
}

async function buildKrPoolSnapshot() {
  const {
    symbols: universeSymbols,
    source: listSource,
    venues: seedVenues,
  } = await loadKoreaUniverseSymbols();
  const quotes = await loadKoreaQuotes();
  const quoteBackfill = await backfillMissingQuotes(universeSymbols, seedVenues, quotes);

  // Preserve list order for ranking when marketCap is missing.
  const listRank = new Map(universeSymbols.map((s, i) => [s, i + 1]));
  // Pool = curated universe only (do not inflate with unrelated korea quotes).
  const symbols = universeSymbols.length ? [...universeSymbols] : [...quotes.keys()];
  const seriesMaps = await loadSeriesMetricsBySymbol(symbols);
  const { rsiBySymbol, volumeBySymbol, momentumBySymbol } = seriesMaps;
  const seriesBackfill = await backfillMissingSeriesMetrics(symbols, seedVenues, seriesMaps);

  const rows = [];
  let excludedCount = 0;
  for (const symbol of symbols) {
    const quote = quotes.get(symbol) || null;
    const name = cleanText(quote?.name) || symbol;
    const exclusion = shouldExcludeFromKrUniverse({ symbol, name, quote });
    if (exclusion.exclude) {
      excludedCount += 1;
      continue;
    }

    const yahooHint =
      quote?.regularSession?.yahooSymbol || quote?.yahooSymbol || quote?.symbol || '';
    // Seed venue wins (fixes default-all-kospi). Else quote market / Yahoo suffix.
    const seedVenue = seedVenues.get(symbol) || null;
    const venue =
      seedVenue ||
      (cleanText(quote?.market || quote?.exchange).toLowerCase() === 'kosdaq'
        ? 'kosdaq'
        : cleanText(quote?.market || quote?.exchange).toLowerCase() === 'kospi'
          ? 'kospi'
          : null) ||
      venueFromYahooHint(yahooHint, quote?.market || quote?.exchange);
    const yahooSymbol =
      (seedVenue ? yahooSymbolForVenue(symbol, seedVenue) : '') ||
      cleanText(yahooHint).match(/^\d{6}\.(KS|KQ)$/i)?.[0]?.toUpperCase() ||
      yahooFromVenue(symbol, venue);

    const marketCap =
      numOrNull(quote?.marketCapitalization) ??
      numOrNull(quote?.marketCap) ??
      metricFromQuote(quote, 'marketCap');

    // Only set turnover when computable; never invent 0.
    let turnoverKrw =
      numOrNull(quote?.turnoverKrw) ??
      numOrNull(quote?.dayVolumeValue) ??
      metricFromQuote(quote, 'turnoverKrw');
    if (turnoverKrw == null) {
      const price = numOrNull(quote?.currentPrice);
      const vol =
        numOrNull(quote?.volume ?? quote?.dayVolume) ?? volumeBySymbol.get(symbol) ?? null;
      if (price != null && vol != null && vol > 0) turnoverKrw = Math.round(price * vol);
    }

    rows.push({
      symbol,
      yahooSymbol,
      name,
      market: venue,
      marketCap,
      listRank: listRank.get(symbol) ?? 10_000,
      currentPrice: numOrNull(quote?.currentPrice),
      changePercent: numOrNull(quote?.changePercent),
      per: metricFromQuote(quote, 'per') ?? metricFromQuote(quote, 'peTTM'),
      pbr: metricFromQuote(quote, 'pbr') ?? metricFromQuote(quote, 'pbAnnual'),
      revenueYoY: metricFromQuote(quote, 'revenueYoY'),
      operatingProfitYoY: metricFromQuote(quote, 'operatingProfitYoY'),
      netProfitYoY: metricFromQuote(quote, 'netProfitYoY'),
      dividend: boolFromQuote(quote, 'dividend'),
      dividendGrowthCapacity: boolFromQuote(quote, 'dividendGrowthCapacity'),
      turnoverKrw,
      rsi: rsiBySymbol.get(symbol) ?? metricFromQuote(quote, 'rsi'),
      ...momentumSlotsOrEmpty(momentumBySymbol.get(symbol)),
    });
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

  const kospi = rankRows(rows.filter((r) => r.market === 'kospi')).slice(0, 30);
  const kosdaq = rankRows(rows.filter((r) => r.market === 'kosdaq')).slice(0, 50);

  let universeRows = [...kospi, ...kosdaq];
  if (universeRows.length < 40) {
    // Venue tags missing: take list-order / mcap top 80 from full pool.
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
  const ranked = universeRows.map((row, index) => {
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
      size: ranked.length,
      asOf,
      source: listSource,
      excludedCount,
      quoteBackfill: quoteBackfill.fetched || 0,
      seriesBackfill: seriesBackfill.fetched || 0,
      exclusions: ['preferred', 'spac', 'restricted'],
      note:
        'Universe from korea_screener_universe with venue. Pool job self-backfills quotes + 1y bars; fills RSI/turnover and momentum (return3m/6m/12m, ma20–200, alignedMa, pctFrom52wHigh, volumeRatio). foreign/institution and fundamentals still null. Caps kospi30/kosdaq50. asOf=job UTC; stale if age>24h.',
    },
    policy: buildPoolPolicy('kr'),
    symbols: ranked,
    createdAt: asOf,
    updatedAt: asOf,
  };
}

/**
 * @param {{ market?: string }} [options]
 * @returns {Promise<object>} snapshot payload ready for upsertCollectionRows
 */
export async function buildScreenerPoolSnapshotFromDb(options = {}) {
  const market = normalizeScreenerMarket(options.market);
  if (market === 'kr') return buildKrPoolSnapshot();
  return emptyPoolSnapshot(
    market,
    `Pool builder for market=${market} is not wired yet. Seed via POST /v1/screener/pool/snapshot/ingest.`,
  );
}
