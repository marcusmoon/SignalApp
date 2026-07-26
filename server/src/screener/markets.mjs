/** Screener markets and method ids. */

import { SCREENER_DEFAULT_METHOD } from './policy.mjs';

export const SCREENER_MARKETS = new Set(['kr', 'global']);

/** Known methods (extensible). Unknown methods still store/serve if ingested. */
export const SCREENER_METHODS = {
  momentum: {
    id: 'momentum',
    title: { kr: '모멘텀', global: 'Momentum · trend' },
    markets: ['kr'], // global support can be added later
  },
};

export function normalizeScreenerMarket(value, { fallback = 'kr' } = {}) {
  const m = String(value || '')
    .trim()
    .toLowerCase();
  if (SCREENER_MARKETS.has(m)) return m;
  return fallback;
}

export function normalizeScreenerMethod(
  value,
  { fallback = SCREENER_DEFAULT_METHOD } = {},
) {
  let method = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return method || fallback;
}

export function defaultMethodTitle(market, method) {
  const meta = SCREENER_METHODS[method];
  if (meta?.title?.[market]) return meta.title[market];
  if (meta?.title?.kr) return meta.title.kr;
  return method;
}

/** Known methods for a market (catalog). Ingest may still use unknown method ids. */
export function listScreenerMethods(market) {
  const m = normalizeScreenerMarket(market);
  return Object.values(SCREENER_METHODS)
    .filter((meta) => !meta.markets?.length || meta.markets.includes(m))
    .map((meta) => ({
      id: meta.id,
      title: meta.title?.[m] || meta.title?.kr || meta.id,
      markets: meta.markets || [...SCREENER_MARKETS],
    }));
}
