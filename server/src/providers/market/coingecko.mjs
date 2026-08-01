import { getProviderSetting } from '../../providerSettings.mjs';

function finiteNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeCoin(raw) {
  const symbol = String(raw.symbol || '').trim().toUpperCase();
  const imageUrl = String(raw.image || '').trim() || null;
  return {
    id: `coin-market-${String(raw.id || symbol).trim()}`,
    provider: 'coingecko',
    providerItemId: String(raw.id || symbol).trim(),
    symbol,
    name: String(raw.name || symbol).trim(),
    imageUrl,
    currentPrice: finiteNumber(raw.current_price),
    marketCap: finiteNumber(raw.market_cap),
    change24h: finiteNumber(raw.price_change_24h),
    changePercent24h: finiteNumber(raw.price_change_percentage_24h),
    fetchedAt: new Date().toISOString(),
    rawPayload: raw,
  };
}

export async function fetchCoinGeckoMarkets({ limit = 30 } = {}) {
  const setting = await getProviderSetting('coingecko');
  if (!setting.enabled) throw new Error('COINGECKO_PROVIDER_DISABLED');
  const perPage = Math.max(1, Math.min(250, Number(limit) || 30));
  const url = new URL('https://api.coingecko.com/api/v3/coins/markets');
  url.searchParams.set('vs_currency', 'usd');
  url.searchParams.set('order', 'market_cap_desc');
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('page', '1');
  url.searchParams.set('sparkline', 'false');
  const res = await fetch(url);
  const body = await res.text();
  if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${body.slice(0, 200)}`);
  const rows = JSON.parse(body);
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeCoin);
}
