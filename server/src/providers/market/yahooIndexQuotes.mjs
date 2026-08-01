/**
 * Yahoo Finance major index quotes for the home 시세 strip.
 * Symbols are caret tickers (^GSPC, ^NDX, …) stored as market_quotes.symbol.
 */

import { fetchYahooQuotes, yahooQuoteTimestamps } from './yahooQuote.mjs';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeYahooIndexSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase();
  if (!/^\^[A-Z0-9.]{1,12}$/.test(symbol)) return '';
  return symbol;
}

function normalizeIndexQuote(yahooSymbol, quote, segment) {
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
    marketCapitalization: finiteNumber(quote?.marketCap),
    quoteTime,
    fetchedAt,
    yahooSymbol,
    regularSession: { yahooSymbol },
    rawPayload: {
      provider: 'yahoo',
      yahooSymbol,
      currency: quote?.currency || null,
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
export async function fetchYahooIndexMarketQuotes({
  symbols = [],
  segment = 'indices',
  concurrency = 6,
} = {}) {
  const normalized = [];
  const seen = new Set();
  for (const value of Array.isArray(symbols) ? symbols : []) {
    const symbol = normalizeYahooIndexSymbol(value);
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
    rows.push(normalizeIndexQuote(symbol, quote, segment));
  }
  return rows;
}
