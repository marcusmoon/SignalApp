/**
 * Yahoo Finance KRX quote ingest — 6-digit codes resolve `.KS` / `.KQ`.
 * Prefer venue-aware suffix (kosdaq→.KQ first). Persists yahooSymbol for later runs.
 */

import { fetchYahooQuote, yahooQuoteTimestamps } from './yahooQuote.mjs';
import { yahooSuffixForVenue, venueFromYahooSymbol } from '../../screener/koreaScreenerUniverse.mjs';

function normalizeKrxSymbol(value) {
  const symbol = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(symbol)) return '';
  return symbol;
}

function normalizeVenue(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'kosdaq' || v === 'kq') return 'kosdaq';
  if (v === 'kospi' || v === 'ks') return 'kospi';
  return null;
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Candidate order:
 * 1) preferred yahoo if it matches venue (or venue unknown)
 * 2) venue-primary suffix
 * 3) the other suffix
 * Never stick to a preferred .KS when venue is kosdaq (common poison from default).
 *
 * @param {string} krxSymbol
 * @param {string | null} preferredYahooSymbol
 * @param {'kospi'|'kosdaq'|null} venue
 */
export function yahooCandidatesForKrx(krxSymbol, preferredYahooSymbol = null, venue = null) {
  const code = normalizeKrxSymbol(krxSymbol);
  if (!code) return [];
  const preferred = String(preferredYahooSymbol || '').trim().toUpperCase();
  const v = normalizeVenue(venue);
  const primary = v ? `${code}${yahooSuffixForVenue(v)}` : `${code}.KS`;
  const secondary = primary.endsWith('.KQ') ? `${code}.KS` : `${code}.KQ`;

  const candidates = [];
  const push = (sym) => {
    if (sym && !candidates.includes(sym)) candidates.push(sym);
  };

  if (preferred && (preferred.endsWith('.KS') || preferred.endsWith('.KQ'))) {
    if (!v || preferred.endsWith(yahooSuffixForVenue(v))) {
      push(preferred);
    }
    // Conflict with venue: skip preferred so we don't keep failing on wrong board.
  }
  push(primary);
  push(secondary);
  return candidates;
}

/**
 * @param {string} krxSymbol
 * @param {string | null} preferredYahooSymbol
 * @param {'kospi'|'kosdaq'|null} venue
 * @returns {Promise<{ yahooSymbol: string, quote: object } | null>}
 */
export async function resolveYahooKrxQuote(
  krxSymbol,
  preferredYahooSymbol = null,
  venue = null,
) {
  const candidates = yahooCandidatesForKrx(krxSymbol, preferredYahooSymbol, venue);
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

function normalizeMarketQuote(krxSymbol, yahooSymbol, quote, segment, venueHint = null) {
  const price = finiteNumber(quote?.price);
  const previousClose = finiteNumber(quote?.previousClose);
  const volume = finiteNumber(quote?.volume);
  let change = null;
  if (price != null && previousClose != null) change = price - previousClose;
  let turnoverKrw = null;
  if (price != null && volume != null && volume > 0) {
    turnoverKrw = Math.round(price * volume);
  }
  const venue =
    normalizeVenue(venueHint) || venueFromYahooSymbol(yahooSymbol) || 'kospi';
  return {
    id: `market-quote-${segment}-${krxSymbol}`,
    provider: 'yahoo',
    providerItemId: yahooSymbol,
    segment,
    symbol: krxSymbol,
    displaySymbol: krxSymbol,
    krxSymbol,
    name: quote?.name || null,
    market: venue,
    exchange: venue,
    currentPrice: price,
    change,
    changePercent: quote?.changePercent ?? null,
    high: null,
    low: null,
    open: null,
    previousClose,
    volume,
    dayVolume: volume,
    turnoverKrw,
    marketCapitalization: finiteNumber(quote?.marketCap),
    ...yahooQuoteTimestamps(quote),
    yahooSymbol,
    regularSession: { yahooSymbol },
    rawPayload: {
      provider: 'yahoo',
      krxSymbol,
      yahooSymbol,
      venue,
      currency: quote?.currency || 'KRW',
      volume,
    },
  };
}

/**
 * @param {{
 *   symbols?: Array<string|{symbol?:string,venue?:string}>,
 *   segment?: string,
 *   preferredYahooBySymbol?: Record<string, string>,
 *   venueBySymbol?: Record<string, string>|Map<string,string>,
 *   concurrency?: number,
 * }} opts
 */
export async function fetchYahooKrxMarketQuotes({
  symbols = [],
  segment = 'korea',
  preferredYahooBySymbol = {},
  venueBySymbol = {},
  concurrency = 4,
} = {}) {
  const venueLookup = venueBySymbol instanceof Map
    ? venueBySymbol
    : new Map(Object.entries(venueBySymbol || {}));

  /** @type {{ code: string, venue: string|null }[]} */
  const normalized = [];
  const seen = new Set();
  for (const value of Array.isArray(symbols) ? symbols : []) {
    let code = '';
    let venue = null;
    if (value && typeof value === 'object') {
      code = normalizeKrxSymbol(value.symbol || value.krxSymbol || value.code);
      venue = normalizeVenue(value.venue || value.market);
    } else {
      code = normalizeKrxSymbol(value);
    }
    if (!code || seen.has(code)) continue;
    seen.add(code);
    if (!venue) venue = normalizeVenue(venueLookup.get(code));
    normalized.push({ code, venue });
  }

  const rows = [];
  for (let i = 0; i < normalized.length; i += concurrency) {
    const batch = normalized.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map(async ({ code, venue }) => {
        const preferred = preferredYahooBySymbol?.[code] || null;
        const resolved = await resolveYahooKrxQuote(code, preferred, venue);
        if (!resolved) return null;
        return normalizeMarketQuote(
          code,
          resolved.yahooSymbol,
          resolved.quote,
          segment,
          venue,
        );
      }),
    );
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled' && outcome.value) rows.push(outcome.value);
    }
  }
  return rows;
}
