const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isKrxSymbol(symbol) {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

export function krxToYahooSymbols(symbol) {
  const code = String(symbol || '').trim();
  if (!/^\d{6}$/.test(code)) return [];
  return [`${code}.KS`, `${code}.KQ`];
}

export function krxToDefaultYahooSymbol(symbol) {
  return krxToYahooSymbols(symbol)[0] || '';
}

async function fetchYahooChart(yahooSymbol, { range, period1, period2, interval = '1d' } = {}) {
  const symbol = String(yahooSymbol || '').trim();
  if (!symbol) return null;

  const params = new URLSearchParams({ interval });
  if (range) params.set('range', range);
  if (Number.isFinite(period1)) params.set('period1', String(Math.floor(period1)));
  if (Number.isFinite(period2)) params.set('period2', String(Math.floor(period2)));

  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?${params.toString()}`;
  const res = await fetch(url, { headers: { 'user-agent': 'SignalApp/krx-market' } });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  return { yahooSymbol: symbol, meta: result.meta || {}, result };
}

async function fetchYahooChartForKrx(krxSymbol, options = {}) {
  for (const yahooSymbol of krxToYahooSymbols(krxSymbol)) {
    const chart = await fetchYahooChart(yahooSymbol, options);
    if (chart?.meta?.regularMarketPrice != null || chart?.result?.timestamp?.length > 0) {
      return chart;
    }
  }
  return null;
}

function quoteFromChart(krxSymbol, chart, segment) {
  const meta = chart?.meta || {};
  const price = finiteNumber(meta.regularMarketPrice);
  if (price == null) return null;

  const previousClose = finiteNumber(meta.chartPreviousClose ?? meta.previousClose);
  let changePercent = null;
  if (previousClose != null && previousClose !== 0) {
    changePercent = parseFloat((((price - previousClose) / previousClose) * 100).toFixed(2));
  }
  const change = previousClose != null ? price - previousClose : null;
  const yahooSymbol = chart.yahooSymbol || krxToDefaultYahooSymbol(krxSymbol);

  return {
    id: `market-quote-${segment}-${krxSymbol}`,
    provider: 'yahoo',
    providerItemId: krxSymbol,
    segment,
    symbol: krxSymbol,
    displaySymbol: krxSymbol,
    krxSymbol,
    name: String(meta.longName || meta.shortName || '').trim() || null,
    currentPrice: price,
    change,
    changePercent,
    high: finiteNumber(meta.regularMarketDayHigh),
    low: finiteNumber(meta.regularMarketDayLow),
    open: null,
    previousClose,
    marketCapitalization: null,
    quoteTime: meta.regularMarketTime
      ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
      : new Date().toISOString(),
    fetchedAt: new Date().toISOString(),
    regularSession: { yahooSymbol },
    rawPayload: { meta },
  };
}

function candlesFromChart(chart, from, to) {
  const result = chart?.result;
  if (!result) return null;
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const volumes = Array.isArray(quote.volume) ? quote.volume : [];

  const t = [];
  const o = [];
  const h = [];
  const l = [];
  const c = [];
  const v = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = finiteNumber(timestamps[i]);
    const close = finiteNumber(closes[i]);
    if (ts == null || close == null) continue;
    if (Number.isFinite(from) && ts < from) continue;
    if (Number.isFinite(to) && ts > to) continue;
    t.push(Math.floor(ts));
    o.push(finiteNumber(opens[i]) ?? close);
    h.push(finiteNumber(highs[i]) ?? close);
    l.push(finiteNumber(lows[i]) ?? close);
    c.push(close);
    v.push(finiteNumber(volumes[i]) || 0);
  }

  if (t.length === 0) return null;
  return { s: 'ok', t, o, h, l, c, v };
}

export async function fetchYahooKrxMarketQuotes({ symbols = [], segment = 'watch' } = {}) {
  const normalized = [...new Set(symbols.map((s) => String(s || '').trim()).filter(isKrxSymbol))];
  if (normalized.length === 0) return [];

  const rows = [];
  for (const krxSymbol of normalized) {
    const chart = await fetchYahooChartForKrx(krxSymbol, { range: '5d' });
    const row = chart ? quoteFromChart(krxSymbol, chart, segment) : null;
    if (row) rows.push(row);
  }
  return rows;
}

export async function fetchYahooKrxStockProfile(symbol) {
  const krxSymbol = String(symbol || '').trim();
  if (!isKrxSymbol(krxSymbol)) return null;
  const chart = await fetchYahooChartForKrx(krxSymbol, { range: '5d' });
  if (!chart) return null;
  const meta = chart.meta || {};
  const name = String(meta.longName || meta.shortName || '').trim();
  if (!name) return null;
  return {
    ticker: krxSymbol,
    symbol: krxSymbol,
    name,
    marketCapitalization: null,
  };
}

export async function fetchYahooKrxStockCandles(symbol, { from, to } = {}) {
  const krxSymbol = String(symbol || '').trim();
  if (!isKrxSymbol(krxSymbol) || !Number.isFinite(from) || !Number.isFinite(to)) return null;
  const chart = await fetchYahooChartForKrx(krxSymbol, {
    period1: Math.floor(from),
    period2: Math.floor(to),
    interval: '1d',
  });
  return chart ? candlesFromChart(chart, Math.floor(from), Math.floor(to)) : null;
}
