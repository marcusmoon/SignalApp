import { fetchCoinsMarketsJson } from './client';
import type { CoinGeckoMarketRow } from './types';

export type { CoinGeckoMarketRow } from './types';

/** 시가총액(USD) 내림차순 상위 `limit`개 */
export async function fetchTopCoinsByMarketCapUsd(limit = 20): Promise<CoinGeckoMarketRow[]> {
  const data = await fetchCoinsMarketsJson(limit);
  if (!Array.isArray(data)) return [];
  return data as CoinGeckoMarketRow[];
}
