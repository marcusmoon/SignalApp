/**
 * Build a KR screener snapshot from market_lists + market_quotes + price_series.
 * Fundamentals (PER/PBR/YoY/dividend) stay null unless present on quote payload —
 * Codex/agent must not invent them; Job only fills price/turnover/RSI when available.
 */
import { queryKysely } from '../db/kysely/client.mjs';
import {
  FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
} from './fujimoto.mjs';
import { computeRsi } from './rsi.mjs';

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

function marketFromYahooHint(symbol, yahooSymbol, quoteMarket) {
  const hint = cleanText(quoteMarket || yahooSymbol).toUpperCase();
  if (hint.includes('.KQ') || hint === 'KOSDAQ') return 'kosdaq';
  if (hint.includes('.KS') || hint === 'KOSPI') return 'kospi';
  // Prefer kospi when unknown — rank pools still capped separately.
  return 'kospi';
}

function closesFromPriceSeriesPayload(payload) {
  const bars = Array.isArray(payload?.bars)
    ? payload.bars
    : Array.isArray(payload?.candles)
      ? payload.candles
      : Array.isArray(payload?.daily)
        ? payload.daily
        : [];
  const closes = [];
  for (const bar of bars) {
    const c = numOrNull(bar?.c ?? bar?.close ?? bar?.Close);
    if (c != null) closes.push(c);
  }
  return closes;
}

async function loadKoreaWatchlistSymbols() {
  const result = await queryKysely(
    `SELECT payload FROM market_lists WHERE list_key = 'korea_watchlist' LIMIT 1`,
    [],
  );
  const payload = result.rows[0]?.payload;
  const symbols = Array.isArray(payload?.symbols) ? payload.symbols : [];
  return symbols.map(normalizeKrCode).filter(Boolean);
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

async function loadRsiBySymbol(symbols) {
  if (!symbols.length) return new Map();
  const upper = symbols.map((s) => s.toUpperCase());
  const result = await queryKysely(
    `
      SELECT symbol, display_symbol, yahoo_symbol, payload
      FROM price_series
      WHERE upper(COALESCE(display_symbol, '')) = ANY($1::text[])
         OR upper(COALESCE(symbol, '')) = ANY($1::text[])
         OR regexp_replace(upper(COALESCE(yahoo_symbol, '')), '\\.(KS|KQ)$', '') = ANY($1::text[])
         OR upper(COALESCE(payload->>'krxSymbol', '')) = ANY($1::text[])
      LIMIT 200
    `,
    [upper],
  );
  const map = new Map();
  for (const row of result.rows) {
    const code =
      normalizeKrCode(row.payload?.krxSymbol) ||
      normalizeKrCode(row.display_symbol) ||
      normalizeKrCode(row.yahoo_symbol) ||
      normalizeKrCode(row.symbol);
    if (!code || map.has(code)) continue;
    const closes = closesFromPriceSeriesPayload(row.payload);
    const rsi = computeRsi(closes, 14);
    if (rsi != null) map.set(code, rsi);
  }
  return map;
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

/**
 * @returns {Promise<object>} snapshot payload ready for upsertCollectionRows
 */
export async function buildKrScreenerSnapshotFromDb() {
  const watchlist = await loadKoreaWatchlistSymbols();
  const quotes = await loadKoreaQuotes();
  const symbolSet = new Set([...watchlist, ...quotes.keys()]);
  const symbols = [...symbolSet];
  const rsiBySymbol = await loadRsiBySymbol(symbols);

  const rows = [];
  for (const symbol of symbols) {
    const quote = quotes.get(symbol) || null;
    const market = marketFromYahooHint(
      symbol,
      quote?.regularSession?.yahooSymbol || quote?.yahooSymbol,
      quote?.market || quote?.exchange,
    );
    const marketCap =
      numOrNull(quote?.marketCapitalization) ??
      numOrNull(quote?.marketCap) ??
      metricFromQuote(quote, 'marketCap');
    const turnoverKrw =
      numOrNull(quote?.turnoverKrw) ??
      numOrNull(quote?.dayVolumeValue) ??
      metricFromQuote(quote, 'turnoverKrw') ??
      (() => {
        const price = numOrNull(quote?.currentPrice);
        const vol = numOrNull(quote?.volume ?? quote?.dayVolume);
        if (price != null && vol != null) return Math.round(price * vol);
        return null;
      })();

    rows.push({
      symbol,
      name: cleanText(quote?.name) || symbol,
      market,
      marketCap,
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
    });
  }

  const kospi = rows
    .filter((r) => r.market === 'kospi')
    .sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1))
    .slice(0, 30);
  const kosdaq = rows
    .filter((r) => r.market === 'kosdaq')
    .sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1))
    .slice(0, 50);

  // If market tags are missing, fall back to market-cap order from the full pool.
  let universeRows = [...kospi, ...kosdaq];
  if (universeRows.length === 0) {
    universeRows = [...rows]
      .sort((a, b) => (b.marketCap ?? -1) - (a.marketCap ?? -1))
      .slice(0, 80);
  }

  const asOf = new Date().toISOString();
  const generatedDate = asOf.slice(0, 10);
  const ranked = universeRows.map((row, index) => {
    const { marketCap: _mc, ...rest } = row;
    return {
      id: `kr-screener-snap:${generatedDate}:${row.symbol}`,
      ...rest,
      universeRank: index + 1,
      passed: false,
      note: '',
      aiGenerated: false,
    };
  });

  return {
    id: `kr-screener-snapshot:${asOf}`,
    generatedAt: asOf,
    generatedDate,
    asOf,
    publishedAt: asOf,
    locale: 'ko',
    universe: {
      kospiTop: 30,
      kosdaqTop: 50,
      asOf,
      source: 'market_quotes_korea_watchlist',
      note:
        'Interim universe from korea quotes/watchlist ranked by marketCap when available. Expand when full KRX mcap feed exists.',
    },
    policy: {
      minTurnoverKrw: FUJIMOTO_DEFAULT_MIN_TURNOVER_KRW,
      requireAllMetrics: true,
    },
    symbols: ranked,
    createdAt: asOf,
    updatedAt: asOf,
  };
}
