/**
 * CoinGecko public API — 시가총액 기준 상위 N개 (API 키 불필요).
 * https://docs.coingecko.com/reference/coins-markets
 */

export type CoinGeckoMarketRow = {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  price_change_24h: number | null;
  price_change_percentage_24h: number | null;
};

const MARKETS_URL = 'https://api.coingecko.com/api/v3/coins/markets';

/** 시가총액(USD) 내림차순 상위 `limit`개 */
export async function fetchTopCoinsByMarketCapUsd(limit = 20): Promise<CoinGeckoMarketRow[]> {
  const u = new URL(MARKETS_URL);
  u.searchParams.set('vs_currency', 'usd');
  u.searchParams.set('order', 'market_cap_desc');
  u.searchParams.set('per_page', String(Math.min(250, Math.max(1, limit))));
  u.searchParams.set('page', '1');
  u.searchParams.set('sparkline', 'false');
  const res = await fetch(u.toString());
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`CoinGecko ${res.status}: ${t.slice(0, 160)}`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data as CoinGeckoMarketRow[];
}
