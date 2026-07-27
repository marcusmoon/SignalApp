/**
 * Yahoo Finance real-time quote fetcher.
 * Uses the /v8/finance/chart endpoint with range=5d&interval=1d so we get
 * regularMarketPrice (intraday current price) plus recent close history for
 * changePercent calculation.
 */

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function resolveYahooPreviousClose(meta = {}, quoteInd = {}, price = null) {
  const direct =
    finiteNumber(meta.chartPreviousClose) ??
    finiteNumber(meta.regularMarketPreviousClose);
  if (direct != null) return direct;

  const allCloses = Array.isArray(quoteInd.close) ? quoteInd.close : [];
  for (let i = allCloses.length - 1; i >= 0; i--) {
    const close = finiteNumber(allCloses[i]);
    if (close == null) continue;
    if (price != null && close === price) continue;
    return close;
  }
  return null;
}

/**
 * Fetches a real-time quote for a single Yahoo Finance symbol.
 * Returns { price, changePercent, previousClose, currency, name, volume, marketCap } or null.
 */
export async function fetchYahooQuote(yahooSymbol) {
  const symbol = String(yahooSymbol || '').trim();
  if (!symbol) return null;

  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, { headers: { 'user-agent': 'SignalApp/quote-proxy' } });
  if (!res.ok) throw new Error(`YAHOO_QUOTE_HTTP_${res.status}`);

  const body = await res.text();
  const json = JSON.parse(body);
  const result = json?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const quoteInd = result.indicators?.quote?.[0] || {};

  // Current price: regularMarketPrice is available intraday
  const price = finiteNumber(meta.regularMarketPrice);

  const previousClose = resolveYahooPreviousClose(meta, quoteInd, price);

  // Change percent: always calculate from (price - previousClose) / previousClose.
  // Do NOT use meta.regularMarketChangePercent — it can reflect the 5-day range
  // start when range=5d is used.
  let changePercent = null;
  if (price != null && previousClose != null && previousClose !== 0) {
    changePercent = (price - previousClose) / previousClose * 100;
  }

  // Volume: prefer meta.regularMarketVolume; else last non-null daily bar volume.
  let volume = finiteNumber(meta.regularMarketVolume);
  if (volume == null) {
    const allVolumes = Array.isArray(quoteInd.volume) ? quoteInd.volume : [];
    for (let i = allVolumes.length - 1; i >= 0; i--) {
      const v = finiteNumber(allVolumes[i]);
      if (v != null && v > 0) {
        volume = v;
        break;
      }
    }
  }

  const name = String(meta.shortName || meta.longName || '').trim() || null;

  return {
    price,
    changePercent: changePercent != null ? parseFloat(changePercent.toFixed(2)) : null,
    previousClose,
    currency: String(meta.currency || '').trim() || null,
    name,
    volume,
    marketCap: finiteNumber(meta.marketCap),
  };
}

/**
 * Fetches quotes for multiple Yahoo Finance symbols in parallel (up to concurrency limit).
 * Returns a map of { [yahooSymbol]: { price, changePercent, previousClose, currency } | null }.
 */
export async function fetchYahooQuotes(yahooSymbols, { concurrency = 8 } = {}) {
  const symbols = (Array.isArray(yahooSymbols) ? yahooSymbols : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean);

  const results = {};
  // Process in batches to respect concurrency
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((sym) => fetchYahooQuote(sym)));
    for (let j = 0; j < batch.length; j += 1) {
      const outcome = settled[j];
      results[batch[j]] = outcome.status === 'fulfilled' ? outcome.value : null;
    }
  }
  return results;
}
