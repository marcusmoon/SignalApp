/**
 * Yahoo Finance FX quotes for the home 환율 strip (USD/KRW, JPY/KRW).
 * Symbols look like USDKRW=X and are stored as market_quotes.symbol.
 */

import { fetchYahooQuotes, yahooQuoteTimestamps } from './yahooQuote.mjs';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Yahoo FX pair: AAA BBB =X (e.g. USDKRW=X). */
export function normalizeYahooFxSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  if (!/^[A-Z]{3}[A-Z]{3}=X$/.test(symbol)) return '';
  return symbol;
}

function normalizeFxQuote(yahooSymbol, quote, segment) {
  const price = finiteNumber(quote?.price);
  const previousClose = finiteNumber(quote?.previousClose);
  let change = null;
  if (price != null && previousClose != null) change = price - previousClose;
  const { quoteTime, fetchedAt } = yahooQuoteTimestamps(quote);
  return {
    id: `market-quote-${segment}-${yahooSymbol}`,
    provider: 'yahoo',
    providerItemId: yahooSymbol,
    segment,
    symbol: yahooSymbol,
    displaySymbol: yahooSymbol,
    name: quote?.name || null,
    currentPrice: price,
    change,
    changePercent: quote?.changePercent ?? null,
    high: null,
    low: null,
    open: null,
    previousClose,
    volume: finiteNumber(quote?.volume),
    marketCapitalization: null,
    quoteTime,
    fetchedAt,
    yahooSymbol,
    regularSession: { yahooSymbol },
    rawPayload: {
      provider: 'yahoo',
      yahooSymbol,
      currency: quote?.currency || null,
      marketTime: quote?.marketTime || null,
    },
  };
}

/**
 * @param {{
 *   symbols?: string[],
 *   segment?: string,
 *   concurrency?: number,
 * }} opts
 */
export async function fetchYahooFxMarketQuotes({
  symbols = [],
  segment = 'fx',
  concurrency = 4,
} = {}) {
  const normalized = [];
  const seen = new Set();
  for (const value of Array.isArray(symbols) ? symbols : []) {
    const symbol = normalizeYahooFxSymbol(value);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    normalized.push(symbol);
  }
  if (normalized.length === 0) return [];

  const quotes = await fetchYahooQuotes(normalized, { concurrency });
  const rows = [];
  for (const symbol of normalized) {
    const quote = quotes[symbol];
    if (!quote || quote.price == null) continue;
    rows.push(normalizeFxQuote(symbol, quote, segment));
  }
  return rows;
}
