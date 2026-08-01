export const MARKET_LIST_KEYS = [
  'mega_cap',
  'mcap_universe',
  'mcap_top_symbols',
  'popular_symbols',
  'default_watchlist',
  'korea_watchlist',
  /** Approximate kospi30+kosdaq50 ordinary shares for screener pool (not a live KRX mcap feed). */
  'korea_screener_universe',
  /** Home 시세 index strip (Yahoo caret tickers). */
  'home_indices',
  /** Home 환율 strip (Yahoo FX pairs). */
  'home_fx',
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

function normalizeVenueMap(venues, entries) {
  const map = {};
  if (venues && typeof venues === 'object') {
    for (const [raw, value] of Object.entries(venues)) {
      const symbol = normalizeMarketSymbol(raw).replace(/\.(KS|KQ)$/i, '');
      const venue = value === 'kosdaq' || value === 'kospi' ? value : null;
      if (/^\d{6}$/.test(symbol) && venue) map[symbol] = venue;
    }
  }
  if (Array.isArray(entries)) {
    for (const row of entries) {
      const symbol = normalizeMarketSymbol(row?.symbol).replace(/\.(KS|KQ)$/i, '');
      const venue = row?.venue === 'kosdaq' || row?.venue === 'kospi' ? row.venue : null;
      if (/^\d{6}$/.test(symbol) && venue) map[symbol] = venue;
    }
  }
  return map;
}

export function normalizeMarketListsShape(lists, nowIso) {
  const existing = Array.isArray(lists) ? lists : [];
  return existing
    .filter((item) => MARKET_LIST_KEYS.includes(item?.key))
    .map((item) => {
      const venues = normalizeVenueMap(item.venues, item.entries);
      const entries = Object.entries(venues).map(([symbol, venue]) => ({ symbol, venue }));
      return {
        ...item,
        displayName: String(item.displayName || item.key),
        description: String(item.description || ''),
        symbols: normalizeMarketSymbols(item.symbols),
        venues,
        entries,
        updatedAt: item.updatedAt || nowIso(),
      };
    });
}

export function publicMarketList(list) {
  return {
    key: list.key,
    displayName: list.displayName,
    description: list.description,
    symbols: list.symbols,
    venues: list.venues && typeof list.venues === 'object' ? list.venues : undefined,
    count: list.symbols.length,
    updatedAt: list.updatedAt,
  };
}
