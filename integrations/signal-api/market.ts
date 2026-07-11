import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiCoinMarket, SignalApiMarketQuote } from '@/integrations/signal-api/types';
import {
  buildSignalCoinsCacheKey,
  buildSignalMarketQuotesCacheKey,
  peekSignalCoinsCache,
  peekSignalMarketQuotesCache,
  storeSignalCoinsCache,
  storeSignalMarketQuotesCache,
} from '@/integrations/signal-api/cache/marketCache';

export async function fetchSignalMarketQuotes(
  params: {
    segment?: string;
    symbols?: readonly string[];
    limit?: number;
    offset?: number;
    refresh?: boolean;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiMarketQuote[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalMarketQuotesCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalMarketQuotesCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiMarketQuote[] }>(
    '/v1/market-quotes',
    {
      segment: params.segment,
      symbols: params.symbols?.join(','),
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      refresh: params.refresh ? '1' : undefined,
    },
    { timeoutMs: params.refresh ? 8000 : 5000, attempts: 1 },
  );
  const rows = json.data;
  if (cacheMode !== 'bypass') storeSignalMarketQuotesCache(cacheKey, rows);
  return rows;
}

export async function fetchSignalCoins(
  params: { limit?: number; offset?: number } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiCoinMarket[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalCoinsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalCoinsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiCoinMarket[] }>(
    '/v1/coins',
    {
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
    { timeoutMs: 5000, attempts: 1 },
  );
  const rows = json.data;
  if (cacheMode !== 'bypass') storeSignalCoinsCache(cacheKey, rows);
  return rows;
}
