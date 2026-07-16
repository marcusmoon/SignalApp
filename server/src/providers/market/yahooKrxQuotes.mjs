/**
 * Yahoo Finance KRX quote ingest — 6-digit codes resolve `.KS` then `.KQ`.
 * Persists `krxSymbol` + `regularSession.yahooSymbol` so later runs skip probing.
 */

import { fetchYahooQuote } from './yahooQuote.mjs';

function normalizeKrxSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(symbol)) return '';
  return symbol;
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} krxSymbol
 * @param {string | null} preferredYahooSymbol
 * @returns {Promise<{ yahooSymbol: string, quote: object } | null>}
 */
export async function resolveYahooKrxQuote(krxSymbol, preferredYahooSymbol = null) {
  const code = normalizeKrxSymbol(krxSymbol);
  if (!code) return null;

  const preferred = String(preferredYahooSymbol || '').trim().toUpperCase();
  const candidates = [];
  if (preferred && (preferred.endsWith('.KS') || preferred.endsWith('.KQ'))) {
    candidates.push(preferred);
  }
  for (const suffix of ['.KS', '.KQ']) {
    const yahooSymbol = `${code}${suffix}`;
    if (!candidates.includes(yahooSymbol)) candidates.push(yahooSymbol);
  }

  for (const yahooSymbol of candidates) {
    try {
      const quote = await fetchYahooQuote(yahooSymbol);
      if (quote?.price != null) return { yahooSymbol, quote };
    } catch {
      /* try next exchange suffix */
    }
  }
  return null;
}

function normalizeMarketQuote(krxSymbol, yahooSymbol, quote, segment) {
  const price = finiteNumber(quote?.price);
  const previousClose = finiteNumber(quote?.previousClose);
  let change = null;
  if (price != null && previousClose != null) change = price - previousClose;
  return {
    id: `market-quote-${segment}-${krxSymbol}`,
    provider: 'yahoo',
    providerItemId: yahooSymbol,
    segment,
    symbol: krxSymbol,
    displaySymbol: krxSymbol,
    krxSymbol,
    name: quote?.name || null,
    currentPrice: price,
    change,
    changePercent: quote?.changePercent ?? null,
    high: null,
    low: null,
    open: null,
    previousClose,
    marketCapitalization: null,
    quoteTime: new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    yahooSymbol,
    regularSession: { yahooSymbol },
    rawPayload: {
      provider: 'yahoo',
      krxSymbol,
      yahooSymbol,
      currency: quote?.currency || 'KRW',
    },
  };
}

/**
 * @param {{ symbols?: string[], segment?: string, preferredYahooBySymbol?: Record<string, string>, concurrency?: number }} opts
 */
export async function fetchYahooKrxMarketQuotes({
  symbols = [],
  segment = 'korea',
  preferredYahooBySymbol = {},
  concurrency = 4,
} = {}) {
  const normalized = [...new Set(
    (Array.isArray(symbols) ? symbols : [])
      .map((value) => {
        if (value && typeof value === 'object') {
          return normalizeKrxSymbol(value.symbol || value.krxSymbol || value.code);
        }
        return normalizeKrxSymbol(value);
      })
      .filter(Boolean),
  )];

  const rows = [];
  for (let i = 0; i < normalized.length; i += concurrency) {
    const batch = normalized.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async (krxSymbol) => {
        const preferred = preferredYahooBySymbol?.[krxSymbol] || null;
        const resolved = await resolveYahooKrxQuote(krxSymbol, preferred);
        if (!resolved) return null;
        return normalizeMarketQuote(krxSymbol, resolved.yahooSymbol, resolved.quote, segment);
      }),
    );
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) rows.push(outcome.value);
    }
  }
  return rows;
}
