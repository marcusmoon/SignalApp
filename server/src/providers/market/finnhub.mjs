import { getProviderSetting } from '../../providerSettings.mjs';

async function finnhub(path, params) {
  const setting = await getProviderSetting('finnhub');
  if (!setting.enabled) throw new Error('FINNHUB_PROVIDER_DISABLED');
  if (!setting.apiKey) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ ...params, token: setting.apiKey });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${q.toString()}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`Finnhub market ${res.status}: ${body.slice(0, 200)}`);
  return JSON.parse(body);
}

function hasValidQuote(q) {
  return q && typeof q.c === 'number' && Number.isFinite(q.c);
}

function normalizeQuote(symbol, quote, segment, profile = null) {
  return {
    id: `market-quote-${segment}-${symbol}`,
    provider: 'finnhub',
    providerItemId: symbol,
    segment,
    symbol,
    name: profile?.name || null,
    currentPrice: quote.c,
    change: quote.d ?? null,
    changePercent: quote.dp ?? null,
    high: quote.h ?? null,
    low: quote.l ?? null,
    open: quote.o ?? null,
    previousClose: quote.pc ?? null,
    marketCapitalization: profile?.marketCapitalization ?? null,
    quoteTime: quote.t ? new Date(Number(quote.t) * 1000).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    rawPayload: quote,
  };
}

export async function fetchFinnhubMarketQuotes({ symbols = [], segment = 'popular' } = {}) {
  const normalized = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  const rows = [];
  for (const symbol of normalized) {
    try {
      const quote = await finnhub('/quote', { symbol });
      if (hasValidQuote(quote)) rows.push(normalizeQuote(symbol, quote, segment));
    } catch {
      /* keep the batch resilient */
    }
  }
  return rows;
}

export async function fetchFinnhubProfile2(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  try {
    return await finnhub('/stock/profile2', { symbol: sym });
  } catch {
    return null;
  }
}

/** @returns Finnhub-shaped candle payload (`s`, `t`, `o`, `h`, `l`, `c`, `v`) or null */
export async function fetchFinnhubStockCandles(symbol, { resolution = 'D', from, to } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym || typeof from !== 'number' || typeof to !== 'number') return null;
  try {
    return await finnhub('/stock/candle', {
      symbol: sym,
      resolution: String(resolution || 'D'),
      from,
      to,
    });
  } catch {
    return null;
  }
}

export async function fetchFinnhubMcapQuotes({ topN = 20, symbols = [], onProgress = null } = {}) {
  const cap = Math.max(1, Math.min(50, Number(topN) || 20));
  const universe = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  const profiles = [];
  for (let i = 0; i < universe.length; i += 1) {
    const symbol = universe[i];
    try {
      const profile = await finnhub('/stock/profile2', { symbol });
      const marketCapitalization = Number(profile?.marketCapitalization || 0);
      if (marketCapitalization > 0) profiles.push({ symbol, profile: { ...profile, marketCapitalization } });
    } catch {
      /* keep the batch resilient */
    }
    if (typeof onProgress === 'function') {
      await onProgress({ phase: 'profiles', done: i + 1, total: universe.length, symbol });
    }
  }
  profiles.sort((a, b) => b.profile.marketCapitalization - a.profile.marketCapitalization);
  const selected = profiles.slice(0, cap);
  const rows = [];
  for (let i = 0; i < selected.length; i += 1) {
    const item = selected[i];
    try {
      const quote = await finnhub('/quote', { symbol: item.symbol });
      if (hasValidQuote(quote)) rows.push(normalizeQuote(item.symbol, quote, 'mcap', item.profile));
    } catch {
      /* keep the batch resilient */
    }
    if (typeof onProgress === 'function') {
      await onProgress({ phase: 'quotes', done: i + 1, total: selected.length, symbol: item.symbol });
    }
  }
  return rows;
}
