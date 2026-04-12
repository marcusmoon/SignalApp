/**
 * CoinGecko REST (공개, 키 없음).
 * 프로데이터/레이트리밋 완화가 필요하면 이후 `services/env` + Pro URL을 여기만 추가.
 */
const API_V3 = 'https://api.coingecko.com/api/v3';

export function buildCoinsMarketsUrl(limit: number): string {
  const u = new URL(`${API_V3}/coins/markets`);
  u.searchParams.set('vs_currency', 'usd');
  u.searchParams.set('order', 'market_cap_desc');
  u.searchParams.set('per_page', String(Math.min(250, Math.max(1, limit))));
  u.searchParams.set('page', '1');
  u.searchParams.set('sparkline', 'false');
  return u.toString();
}

export async function fetchCoinsMarketsJson(limit: number): Promise<unknown> {
  const res = await fetch(buildCoinsMarketsUrl(limit));
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`CoinGecko ${res.status}: ${t.slice(0, 160)}`);
  }
  return res.json();
}
