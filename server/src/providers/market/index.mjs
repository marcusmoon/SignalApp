import {
  fetchFinnhubMarketQuotes,
  fetchFinnhubMcapQuotes,
  fetchFinnhubMcapUniverse,
  fetchFinnhubProfile2,
  fetchFinnhubStockCandles,
} from './finnhub.mjs';
import {
  fetchYahooKrxMarketQuotes,
  fetchYahooKrxStockCandles,
  fetchYahooKrxStockProfile,
  isKrxSymbol,
} from './yahooKrx.mjs';
import { getProviderSetting } from '../../providerSettings.mjs';

async function activeEquityMarketProvider() {
  const finnhub = await getProviderSetting('finnhub');
  if (finnhub.enabled) return 'finnhub';
  throw new Error('MARKET_PROVIDER_DISABLED');
}

function partitionSymbols(symbols = []) {
  const normalized = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  const krx = normalized.filter(isKrxSymbol);
  const us = normalized.filter((sym) => !isKrxSymbol(sym));
  return { krx, us };
}

export async function fetchMarketQuotes({ symbols = [], segment = 'popular' } = {}) {
  const { krx, us } = partitionSymbols(symbols);
  const rows = [];

  if (us.length > 0) {
    const provider = await activeEquityMarketProvider();
    if (provider === 'finnhub') rows.push(...(await fetchFinnhubMarketQuotes({ symbols: us, segment })));
    else throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
  }
  if (krx.length > 0) {
    rows.push(...(await fetchYahooKrxMarketQuotes({ symbols: krx, segment })));
  }
  return rows;
}

export async function fetchMcapQuotes({ topN = 20, symbols = [], onProgress = null } = {}) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubMcapQuotes({ topN, symbols, onProgress });
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchMcapUniverse({ topN = 20, symbols = [], targetListKey = 'mcap_top_symbols', onProgress = null } = {}) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubMcapUniverse({ topN, symbols, targetListKey, onProgress });
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchStockProfile(symbol) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (isKrxSymbol(sym)) return fetchYahooKrxStockProfile(sym);

  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubProfile2(sym);
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchStockCandles(symbol, params = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (isKrxSymbol(sym)) return fetchYahooKrxStockCandles(sym, params);

  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubStockCandles(sym, params);
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}
