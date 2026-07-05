import { tossInvestRequest } from './client.mjs';

function normalizeSymbols(symbols) {
  const list = Array.isArray(symbols)
    ? symbols
    : String(symbols || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  return [...new Set(list.map((s) => String(s).trim()).filter(Boolean))];
}

function chunkSymbols(symbols, size = 200) {
  const chunks = [];
  for (let i = 0; i < symbols.length; i += size) chunks.push(symbols.slice(i, i + size));
  return chunks;
}

/** @returns {Promise<Array<{ symbol: string, lastPrice: string, currency: string, timestamp?: string|null }>>} */
export async function fetchTossInvestPrices(symbols) {
  const normalized = normalizeSymbols(symbols);
  if (normalized.length === 0) return [];
  const rows = [];
  for (const batch of chunkSymbols(normalized)) {
    const result = await tossInvestRequest('/api/v1/prices', {
      params: { symbols: batch.join(',') },
    });
    if (Array.isArray(result)) rows.push(...result);
  }
  return rows;
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestOrderbook(symbol) {
  const sym = String(symbol || '').trim();
  if (!sym) return null;
  return tossInvestRequest('/api/v1/orderbook', { params: { symbol: sym } });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestTrades(symbol, { count = 50 } = {}) {
  const sym = String(symbol || '').trim();
  if (!sym) return null;
  return tossInvestRequest('/api/v1/trades', { params: { symbol: sym, count } });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestPriceLimits(symbol) {
  const sym = String(symbol || '').trim();
  if (!sym) return null;
  return tossInvestRequest('/api/v1/price-limits', { params: { symbol: sym } });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestCandles(symbol, { interval = '1d', count = 100, before = null, adjusted = true } = {}) {
  const sym = String(symbol || '').trim();
  if (!sym) return null;
  return tossInvestRequest('/api/v1/candles', {
    params: {
      symbol: sym,
      interval,
      count,
      before: before || undefined,
      adjusted,
    },
  });
}

/** @returns {Promise<Array<object>>} */
export async function fetchTossInvestStocks(symbols) {
  const normalized = normalizeSymbols(symbols);
  if (normalized.length === 0) return [];
  const rows = [];
  for (const batch of chunkSymbols(normalized)) {
    const result = await tossInvestRequest('/api/v1/stocks', {
      params: { symbols: batch.join(',') },
    });
    if (Array.isArray(result)) rows.push(...result);
  }
  return rows;
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestStockWarnings(symbol) {
  const sym = String(symbol || '').trim();
  if (!sym) return null;
  return tossInvestRequest(`/api/v1/stocks/${encodeURIComponent(sym)}/warnings`);
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestExchangeRate({ baseCurrency = 'USD', quoteCurrency = 'KRW', dateTime = null } = {}) {
  return tossInvestRequest('/api/v1/exchange-rate', {
    params: {
      baseCurrency,
      quoteCurrency,
      dateTime: dateTime || undefined,
    },
  });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestKrMarketCalendar({ date = null } = {}) {
  return tossInvestRequest('/api/v1/market-calendar/KR', {
    params: { date: date || undefined },
  });
}

/** @returns {Promise<object|null>} */
export async function fetchTossInvestUsMarketCalendar({ date = null } = {}) {
  return tossInvestRequest('/api/v1/market-calendar/US', {
    params: { date: date || undefined },
  });
}
