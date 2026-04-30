import {
  fetchFinnhubMarketQuotes,
  fetchFinnhubMcapQuotes,
  fetchFinnhubProfile2,
  fetchFinnhubStockCandles,
} from './finnhub.mjs';
import { getProviderSetting } from '../../providerSettings.mjs';

async function activeEquityMarketProvider() {
  // Today only Finnhub is implemented, but this indirection is intentional:
  // when we add another provider, we switch/route here and keep the rest of the server stable.
  const finnhub = await getProviderSetting('finnhub');
  if (finnhub.enabled) return 'finnhub';
  throw new Error('MARKET_PROVIDER_DISABLED');
}

export async function fetchMarketQuotes({ symbols = [], segment = 'popular' } = {}) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubMarketQuotes({ symbols, segment });
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchMcapQuotes({ topN = 20, symbols = [], onProgress = null } = {}) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubMcapQuotes({ topN, symbols, onProgress });
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchStockProfile(symbol) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubProfile2(symbol);
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

export async function fetchStockCandles(symbol, params = {}) {
  const provider = await activeEquityMarketProvider();
  if (provider === 'finnhub') return fetchFinnhubStockCandles(symbol, params);
  throw new Error(`MARKET_PROVIDER_NOT_IMPLEMENTED:${provider}`);
}

