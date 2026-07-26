export const MARKET_LIST_KEYS = [
  'mega_cap',
  'mcap_universe',
  'mcap_top_symbols',
  'popular_symbols',
  'default_watchlist',
  'korea_watchlist',
  /** Approximate kospi30+kosdaq50 ordinary shares for screener pool (not a live KRX mcap feed). */
  'korea_screener_universe',
];

export function normalizeMarketSymbol(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

export function normalizeMarketSymbols(values) {
  const input = Array.isArray(values)
    ? values
    : String(values || '')
        .split(/[\s,]+/)
        .filter(Boolean);
  return [...new Set(input.map(normalizeMarketSymbol).filter(Boolean))];
}

export function normalizeMarketListsShape(lists, nowIso) {
  const existing = Array.isArray(lists) ? lists : [];
  return existing
    .filter((item) => MARKET_LIST_KEYS.includes(item?.key))
    .map((item) => ({
      ...item,
      displayName: String(item.displayName || item.key),
      description: String(item.description || ''),
      symbols: normalizeMarketSymbols(item.symbols),
      updatedAt: item.updatedAt || nowIso(),
    }));
}

export function publicMarketList(list) {
  return {
    key: list.key,
    displayName: list.displayName,
    description: list.description,
    symbols: list.symbols,
    count: list.symbols.length,
    updatedAt: list.updatedAt,
  };
}
