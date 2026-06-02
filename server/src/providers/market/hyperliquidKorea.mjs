const HYPERLIQUID_INFO_URL = 'https://api.hyperliquid.xyz/info';
const YAHOO_KRW_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?range=1d&interval=1m';

const DEFAULT_NOTICE = '공식 거래소 시세가 아닌 해외 파생상품 기반 참고가입니다.';

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeSymbol(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function normalizeInstrument(input = {}) {
  const symbol = normalizeSymbol(input.symbol || input.krxSymbol || input.code);
  const name = String(input.name || input.displayName || symbol || '').trim();
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
    name: name || symbol,
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

function normalizeAfterHoursQuote({ instrument, mid, usdKrw, fetchedAt, params }) {
  const currentPrice = mid.priceUsd * usdKrw;
  const previousClose = instrument.regularCloseKrw;
  const change = previousClose ? currentPrice - previousClose : null;
  const changePercent = previousClose ? (change / previousClose) * 100 : null;
  return {
    id: `market-quote-kr_after_hours-${instrument.symbol}`,
    provider: 'hyperliquid',
    providerItemId: mid.coin,
    segment: 'kr_after_hours',
    symbol: instrument.symbol,
    name: instrument.name,
    currentPrice,
    change,
    changePercent,
    high: null,
    low: null,
    open: null,
    previousClose,
    marketCapitalization: instrument.marketCapitalization,
    quoteTime: fetchedAt,
    fetchedAt,
    sourceLabel: '해외 파생 참고가',
    official: false,
    notice: params.notice || DEFAULT_NOTICE,
    rawPayload: {
      source: 'hyperliquid',
      hyperliquidCoin: mid.coin,
      priceUsd: mid.priceUsd,
      usdKrw,
      regularCloseKrw: previousClose,
      official: false,
    },
  };
}

export async function fetchHyperliquidKoreaAfterHours(params = {}) {
  const instruments = (Array.isArray(params.instruments) ? params.instruments : [])
    .map(normalizeInstrument)
    .filter((item) => item.symbol && item.candidates.length > 0);
  if (instruments.length === 0) return [];

  const [mids, usdKrw] = await Promise.all([
    fetchAllMids({ dex: String(params.dex || '') }),
    resolveUsdKrw(params),
  ]);
  const fetchedAt = new Date().toISOString();
  const rows = [];
  for (const instrument of instruments) {
    const mid = findMid(mids, instrument.candidates);
    if (!mid) continue;
    rows.push(normalizeAfterHoursQuote({ instrument, mid, usdKrw, fetchedAt, params }));
  }
  return rows;
}
