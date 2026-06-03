const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
const YAHOO_KRW_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=1d&interval=1m';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const DEFAULT_NOTICE = '공식 거래소 시세가 아닌 해외 파생상품 기반 참고가입니다.';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function defaultYahooSymbol(symbol) {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) return '';
  if (normalized.includes('.')) return normalized;
  return `${normalized}.KS`;
}

function normalizeInstrument(input = {}) {
  const symbol = normalizeSymbol(input.symbol || input.krxSymbol || input.code);
  const name = String(input.name || input.displayName || symbol || '').trim();
  const displaySymbol = String(input.displaySymbol || input.englishName || input.englishSymbol || '').trim();
  const candidates = [
    input.hyperliquidSymbol,
    input.hyperliquidCoin,
    input.providerItemId,
    ...(Array.isArray(input.candidates) ? input.candidates : []),
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  return {
    symbol,
    displaySymbol: displaySymbol || symbol,
    name: name || symbol,
    yahooSymbol: String(input.yahooSymbol || input.yahooTicker || defaultYahooSymbol(symbol)).trim().toUpperCase(),
    candidates: [...new Set(candidates)],
    regularCloseKrw: finiteNumber(input.regularCloseKrw ?? input.previousCloseKrw ?? input.closeKrw),
    marketCapitalization: finiteNumber(input.marketCapitalization),
  };
}

async function hyperliquidInfo(payload) {
  const res = await fetch(HYPERLIQUID_INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HYPERLIQUID_INFO_${res.status}:${body.slice(0, 200)}`);
  return JSON.parse(body);
}

async function fetchAllMids({ dex = '' } = {}) {
  const payload = { type: 'allMids' };
  if (dex) payload.dex = dex;
  const mids = await hyperliquidInfo(payload);
  if (!mids || typeof mids !== 'object' || Array.isArray(mids)) throw new Error('HYPERLIQUID_MIDS_INVALID');
  return mids;
}

async function fetchYahooUsdKrw() {
  const res = await fetch(YAHOO_KRW_URL);
  const body = await res.text();
  if (!res.ok) throw new Error(`YAHOO_USD_KRW_${res.status}:${body.slice(0, 120)}`);
  const json = JSON.parse(body);
  const result = json?.chart?.result?.[0];
  const metaPrice = finiteNumber(result?.meta?.regularMarketPrice);
  if (metaPrice) return metaPrice;
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : [];
  for (let i = closes.length - 1; i >= 0; i -= 1) {
    const n = finiteNumber(closes[i]);
    if (n) return n;
  }
  return null;
}

async function fetchYahooRegularQuote(yahooSymbol) {
  const symbol = String(yahooSymbol || '').trim();
  if (!symbol) return null;
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`YAHOO_KR_QUOTE_${res.status}:${body.slice(0, 120)}`);
  const json = JSON.parse(body);
  const result = json?.chart?.result?.[0];
  if (!result) return null;
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const opens = Array.isArray(quote.open) ? quote.open : [];
  const highs = Array.isArray(quote.high) ? quote.high : [];
  const lows = Array.isArray(quote.low) ? quote.low : [];
  const timestamps = Array.isArray(result.timestamp) ? result.timestamp : [];

  const currentPrice = finiteNumber(meta.regularMarketPrice) ?? [...closes].reverse().map(finiteNumber).find((n) => n != null) ?? null;
  const previousClose =
    finiteNumber(meta.previousClose) ??
    finiteNumber(meta.chartPreviousClose) ??
    [...closes].slice(0, -1).reverse().map(finiteNumber).find((n) => n != null) ??
    null;
  if (currentPrice == null && previousClose == null) return null;
  const change = currentPrice != null && previousClose != null ? currentPrice - previousClose : null;
  const changePercent = change != null && previousClose ? (change / previousClose) * 100 : null;
  const lastTimestamp = timestamps.length ? finiteNumber(timestamps[timestamps.length - 1]) : finiteNumber(meta.regularMarketTime);
  return {
    symbol,
    currentPrice,
    previousClose,
    change,
    changePercent,
    open: finiteNumber(meta.regularMarketOpen) ?? [...opens].reverse().map(finiteNumber).find((n) => n != null) ?? null,
    high: finiteNumber(meta.regularMarketDayHigh) ?? [...highs].reverse().map(finiteNumber).find((n) => n != null) ?? null,
    low: finiteNumber(meta.regularMarketDayLow) ?? [...lows].reverse().map(finiteNumber).find((n) => n != null) ?? null,
    quoteTime: lastTimestamp ? new Date(lastTimestamp * 1000).toISOString() : null,
  };
}

async function resolveUsdKrw(params = {}) {
  const explicit = finiteNumber(params.usdKrw ?? params.usdKrwRate);
  if (explicit) return explicit;
  try {
    const fromYahoo = await fetchYahooUsdKrw();
    if (fromYahoo) return fromYahoo;
  } catch {
    // Fall through to the explicit/fallback branch below.
  }
  const fallback = finiteNumber(params.fallbackUsdKrw);
  if (fallback) return fallback;
  throw new Error('USD_KRW_UNAVAILABLE');
}

function findMid(mids, candidates) {
  for (const candidate of candidates) {
    if (mids[candidate] != null) {
      const n = finiteNumber(mids[candidate]);
      if (n) return { coin: candidate, priceUsd: n };
    }
    const upper = candidate.toUpperCase();
    const matchKey = Object.keys(mids).find((key) => String(key).toUpperCase() === upper);
    if (matchKey) {
      const n = finiteNumber(mids[matchKey]);
      if (n) return { coin: matchKey, priceUsd: n };
    }
  }
  return null;
}

function normalizeAfterHoursQuote({ instrument, mid, usdKrw, regular, fetchedAt, params }) {
  const hasAfterHours = Boolean(mid && usdKrw);
  const afterHoursPrice = hasAfterHours ? mid.priceUsd * usdKrw : null;
  const regularCurrentPrice = regular?.currentPrice ?? null;
  const previousClose = instrument.regularCloseKrw ?? regular?.previousClose ?? null;
  const currentPrice = afterHoursPrice ?? regularCurrentPrice ?? previousClose;
  if (currentPrice == null) return null;
  const change = hasAfterHours
    ? previousClose
      ? currentPrice - previousClose
      : null
    : regular?.change ?? (previousClose ? currentPrice - previousClose : null);
  const changePercent = hasAfterHours
    ? previousClose && change != null
      ? (change / previousClose) * 100
      : null
    : regular?.changePercent ?? (previousClose && change != null ? (change / previousClose) * 100 : null);
  return {
    id: `market-quote-kr_after_hours-${instrument.symbol}`,
    provider: 'hyperliquid',
    providerItemId: mid?.coin || instrument.yahooSymbol || instrument.symbol,
    segment: 'kr_after_hours',
    symbol: instrument.displaySymbol || instrument.symbol,
    displaySymbol: instrument.displaySymbol || instrument.symbol,
    krxSymbol: instrument.symbol,
    name: instrument.name,
    currentPrice,
    change,
    changePercent,
    high: hasAfterHours ? null : regular?.high ?? null,
    low: hasAfterHours ? null : regular?.low ?? null,
    open: hasAfterHours ? null : regular?.open ?? null,
    previousClose,
    marketCapitalization: instrument.marketCapitalization,
    quoteTime: hasAfterHours ? fetchedAt : regular?.quoteTime || fetchedAt,
    fetchedAt,
    sourceLabel: hasAfterHours ? '해외 파생 참고가' : '야간 참고가 대기',
    official: hasAfterHours ? false : true,
    notice: params.notice || DEFAULT_NOTICE,
    afterHoursAvailable: hasAfterHours,
    regularSession: regular
      ? {
          yahooSymbol: instrument.yahooSymbol,
          currentPrice: regular.currentPrice,
          change: regular.change,
          changePercent: regular.changePercent,
          high: regular.high,
          low: regular.low,
          open: regular.open,
          previousClose: regular.previousClose,
          quoteTime: regular.quoteTime,
        }
      : null,
    rawPayload: {
      source: 'hyperliquid',
      hyperliquidCoin: mid?.coin || null,
      priceUsd: mid?.priceUsd ?? null,
      usdKrw,
      krxSymbol: instrument.symbol,
      displaySymbol: instrument.displaySymbol,
      yahooSymbol: instrument.yahooSymbol,
      regularCloseKrw: previousClose,
      regularSession: regular,
      afterHoursAvailable: hasAfterHours,
      official: hasAfterHours ? false : true,
    },
  };
}

export async function fetchHyperliquidKoreaAfterHours(params = {}) {
  const instruments = (Array.isArray(params.instruments) ? params.instruments : [])
    .map(normalizeInstrument)
    .filter((item) => item.symbol && (item.candidates.length > 0 || item.yahooSymbol));
  if (instruments.length === 0) return [];

  const [mids, usdKrw, regularQuotes] = await Promise.all([
    fetchAllMids({ dex: String(params.dex || 'xyz') }).catch(() => ({})),
    resolveUsdKrw(params).catch(() => null),
    Promise.all(
      instruments.map((instrument) =>
        fetchYahooRegularQuote(instrument.yahooSymbol)
          .then((quote) => [instrument.symbol, quote])
          .catch(() => [instrument.symbol, null]),
      ),
    ).then((entries) => new Map(entries)),
  ]);
  const fetchedAt = new Date().toISOString();
  const rows = [];
  for (const instrument of instruments) {
    const mid = usdKrw ? findMid(mids, instrument.candidates) : null;
    const regular = regularQuotes.get(instrument.symbol) || null;
    const row = normalizeAfterHoursQuote({ instrument, mid, usdKrw, regular, fetchedAt, params });
    if (row) rows.push(row);
  }
  return rows;
}
