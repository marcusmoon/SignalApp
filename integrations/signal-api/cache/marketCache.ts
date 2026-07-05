import type { SignalApiCoinMarket, SignalApiMarketList, SignalApiMarketQuote } from '@/integrations/signal-api/types';
import {
  peekCache,
  SIGNAL_CATALOG_CACHE_TTL_MS,
  SIGNAL_MARKET_CACHE_TTL_MS,
  storeCache,
} from '@/integrations/signal-api/cache/common';

const quotesCache = new Map<string, { value: SignalApiMarketQuote[]; expiresAt: number }>();
const coinsCache = new Map<string, { value: SignalApiCoinMarket[]; expiresAt: number }>();
const marketListCache = new Map<string, { value: SignalApiMarketList; expiresAt: number }>();

export function buildSignalMarketQuotesCacheKey(params: {
  segment?: string;
  symbols?: readonly string[];
  limit?: number;
  offset?: number;
}): string {
  const symbols = params.symbols
    ? [...params.symbols]
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
        .sort()
        .join(',')
    : '';
  return `market-quotes|${String(params.segment || '').trim()}|${symbols}|${params.limit ?? 100}|${params.offset ?? 0}`;
}

export function buildSignalCoinsCacheKey(params: { limit?: number; offset?: number }): string {
  return `coins|${params.limit ?? 100}|${params.offset ?? 0}`;
}

export function buildSignalMarketListCacheKey(key: string): string {
  return `market-list|${String(key || '').trim()}`;
}

export function peekSignalMarketQuotesCache(key: string): SignalApiMarketQuote[] | null {
  return peekCache(quotesCache, key);
}

export function storeSignalMarketQuotesCache(key: string, value: SignalApiMarketQuote[]): void {
  storeCache(quotesCache, key, value, SIGNAL_MARKET_CACHE_TTL_MS);
}

export function peekSignalCoinsCache(key: string): SignalApiCoinMarket[] | null {
  return peekCache(coinsCache, key);
}

export function storeSignalCoinsCache(key: string, value: SignalApiCoinMarket[]): void {
  storeCache(coinsCache, key, value, SIGNAL_MARKET_CACHE_TTL_MS);
}

export function peekSignalMarketListCache(key: string): SignalApiMarketList | null {
  return peekCache(marketListCache, key);
}

export function storeSignalMarketListCache(key: string, value: SignalApiMarketList): void {
  storeCache(marketListCache, key, value, SIGNAL_CATALOG_CACHE_TTL_MS);
}

export function clearSignalMarketCache(): void {
  quotesCache.clear();
  coinsCache.clear();
  marketListCache.clear();
}
