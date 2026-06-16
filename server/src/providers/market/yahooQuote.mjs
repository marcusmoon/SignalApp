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

/**
 * Fetches a real-time quote for a single Yahoo Finance symbol.
 * Returns { price, changePercent, previousClose, currency } or null on failure.
 */
async function fetchYahooQuote(yahooSymbol) {
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

  // Current price: regularMarketPrice is available intraday
  const price = finiteNumber(meta.regularMarketPrice);

  // Previous close: try meta fields first, then fall back to second-to-last bar
  let previousClose = finiteNumber(meta.previousClose ?? meta.chartPreviousClose);
  if (previousClose == null) {
    const closes = (result.indicators?.quote?.[0]?.close ?? []).filter((v) => v != null);
    if (closes.length >= 2) previousClose = finiteNumber(closes[closes.length - 2]);
    else if (closes.length === 1 && price != null) previousClose = finiteNumber(closes[0]);
  }

  // Change percent: prefer meta value, calculate if absent
  let changePercent = finiteNumber(meta.regularMarketChangePercent);
  if (changePercent == null && price != null && previousClose != null && previousClose !== 0) {
    changePercent = (price - previousClose) / previousClose * 100;
  }

  return {
    price,
    changePercent: changePercent != null ? parseFloat(changePercent.toFixed(2)) : null,
    previousClose,
    currency: String(meta.currency || '').trim() || null,
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
