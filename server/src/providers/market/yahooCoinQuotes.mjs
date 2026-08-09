/**
 * Yahoo Finance crypto quotes for the curated `crypto_symbols` market list.
 * List entries are Yahoo pairs (BTC-USD); stored coin `symbol` is the base (BTC).
 */

import { fetchYahooQuotes, yahooQuoteTimestamps } from './yahooQuote.mjs';

/** Stable icon CDN for majors (Yahoo has no logo field). */
const COIN_LOGO_BY_BASE = {
  BTC: 'https://assets.coincap.io/assets/icons/btc@2x.png',
  ETH: 'https://assets.coincap.io/assets/icons/eth@2x.png',
  BNB: 'https://assets.coincap.io/assets/icons/bnb@2x.png',
  XRP: 'https://assets.coincap.io/assets/icons/xrp@2x.png',
  SOL: 'https://assets.coincap.io/assets/icons/sol@2x.png',
  DOGE: 'https://assets.coincap.io/assets/icons/doge@2x.png',
  ADA: 'https://assets.coincap.io/assets/icons/ada@2x.png',
  AVAX: 'https://assets.coincap.io/assets/icons/avax@2x.png',
  TON: 'https://assets.coincap.io/assets/icons/ton@2x.png',
  LINK: 'https://assets.coincap.io/assets/icons/link@2x.png',
  TRX: 'https://assets.coincap.io/assets/icons/trx@2x.png',
  DOT: 'https://assets.coincap.io/assets/icons/dot@2x.png',
  MATIC: 'https://assets.coincap.io/assets/icons/matic@2x.png',
  POL: 'https://assets.coincap.io/assets/icons/matic@2x.png',
  SHIB: 'https://assets.coincap.io/assets/icons/shib@2x.png',
  LTC: 'https://assets.coincap.io/assets/icons/ltc@2x.png',
  BCH: 'https://assets.coincap.io/assets/icons/bch@2x.png',
  ATOM: 'https://assets.coincap.io/assets/icons/atom@2x.png',
  UNI: 'https://assets.coincap.io/assets/icons/uni@2x.png',
  NEAR: 'https://assets.coincap.io/assets/icons/near@2x.png',
  APT: 'https://assets.coincap.io/assets/icons/apt@2x.png',
  USDT: 'https://assets.coincap.io/assets/icons/usdt@2x.png',
  USDC: 'https://assets.coincap.io/assets/icons/usdc@2x.png',
};

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** `BTC-USD` / `BTC` → Yahoo pair `BTC-USD`. */
export function normalizeYahooCryptoPair(value) {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!raw) return '';
  if (/^[A-Z0-9]{2,12}-USD$/.test(raw)) return raw;
  if (/^[A-Z0-9]{2,12}$/.test(raw)) return `${raw}-USD`;
  return '';
}

/** `BTC-USD` → display/base symbol `BTC`. */
export function baseCryptoSymbol(yahooPair) {
  const pair = normalizeYahooCryptoPair(yahooPair);
  if (!pair) return '';
  return pair.replace(/-USD$/, '');
}

export function coinLogoUrlForBase(baseSymbol) {
  const key = String(baseSymbol || '')
    .trim()
    .toUpperCase();
  return COIN_LOGO_BY_BASE[key] || null;
}

function normalizeCoinRow(yahooPair, quote, listPosition) {
  const base = baseCryptoSymbol(yahooPair);
  if (!base || !quote || quote.price == null) return null;
  const price = finiteNumber(quote.price);
  const previousClose = finiteNumber(quote.previousClose);
  let change24h = null;
  if (price != null && previousClose != null) change24h = price - previousClose;
  const { fetchedAt } = yahooQuoteTimestamps(quote);
  const name = String(quote.name || '').trim() || base;
  return {
    id: `coin-market-${base.toLowerCase()}`,
    provider: 'yahoo',
    providerItemId: yahooPair,
    symbol: base,
    name,
    imageUrl: coinLogoUrlForBase(base),
    currentPrice: price,
    marketCap: finiteNumber(quote.marketCap),
    change24h,
    changePercent24h: quote.changePercent ?? null,
    listPosition: Number.isFinite(Number(listPosition)) ? Number(listPosition) : null,
    quoteTime: yahooQuoteTimestamps(quote).quoteTime,
    fetchedAt,
    yahooSymbol: yahooPair,
    rawPayload: {
      provider: 'yahoo',
      yahooSymbol: yahooPair,
      currency: quote.currency || 'USD',
      marketTime: quote.marketTime || null,
    },
  };
}

/**
 * @param {{
 *   symbols?: string[],
 *   concurrency?: number,
 * }} opts
 */
export async function fetchYahooCoinMarkets({ symbols = [], concurrency = 6 } = {}) {
  const normalized = [];
  const seen = new Set();
  for (const value of Array.isArray(symbols) ? symbols : []) {
    const pair = normalizeYahooCryptoPair(value);
    if (!pair || seen.has(pair)) continue;
    seen.add(pair);
    normalized.push(pair);
  }
  if (normalized.length === 0) return [];

  const quotes = await fetchYahooQuotes(normalized, { concurrency });
  const rows = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const pair = normalized[i];
    const row = normalizeCoinRow(pair, quotes[pair], i);
    if (row) rows.push(row);
  }
  return rows;
}
