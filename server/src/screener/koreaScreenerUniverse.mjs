/**
 * Approximate KR screener universe with explicit venue (kospi|kosdaq).
 * Not a live KRX mcap feed — keep in sync with V3/V4 market_lists seed.
 *
 * Venue matters: Yahoo suffix is .KS (kospi) / .KQ (kosdaq). Wrong suffix
 * causes quote misses and eternal null metrics.
 */

/** @typedef {'kospi'|'kosdaq'} KrVenue */

/** @type {{ symbol: string, venue: KrVenue }[]} */
export const KOREA_SCREENER_UNIVERSE_ENTRIES = [
  // ~kospi large ordinary (list order ≈ mcap weight)
  { symbol: '005930', venue: 'kospi' },
  { symbol: '000660', venue: 'kospi' },
  { symbol: '373220', venue: 'kospi' },
  { symbol: '207940', venue: 'kospi' },
  { symbol: '005380', venue: 'kospi' },
  { symbol: '000270', venue: 'kospi' },
  { symbol: '068270', venue: 'kospi' },
  { symbol: '105560', venue: 'kospi' },
  { symbol: '005490', venue: 'kospi' },
  { symbol: '035420', venue: 'kospi' },
  { symbol: '006400', venue: 'kospi' },
  { symbol: '051910', venue: 'kospi' },
  { symbol: '028260', venue: 'kospi' },
  { symbol: '012330', venue: 'kospi' },
  { symbol: '055550', venue: 'kospi' },
  { symbol: '066570', venue: 'kospi' },
  { symbol: '003670', venue: 'kospi' },
  { symbol: '096770', venue: 'kospi' },
  { symbol: '032830', venue: 'kospi' },
  { symbol: '034730', venue: 'kospi' },
  { symbol: '003550', venue: 'kospi' },
  { symbol: '017670', venue: 'kospi' },
  { symbol: '030200', venue: 'kospi' },
  { symbol: '086790', venue: 'kospi' },
  { symbol: '009150', venue: 'kospi' },
  { symbol: '010130', venue: 'kospi' },
  { symbol: '011200', venue: 'kospi' },
  { symbol: '259960', venue: 'kospi' },
  { symbol: '035720', venue: 'kospi' },
  { symbol: '000810', venue: 'kospi' },
  { symbol: '402340', venue: 'kospi' },
  { symbol: '034020', venue: 'kospi' },
  { symbol: '329180', venue: 'kospi' },
  { symbol: '012450', venue: 'kospi' },
  { symbol: '035760', venue: 'kospi' },
  { symbol: '036570', venue: 'kospi' },
  { symbol: '039490', venue: 'kospi' },
  { symbol: '000100', venue: 'kospi' },
  { symbol: '128940', venue: 'kospi' },
  { symbol: '214320', venue: 'kospi' },
  // ~kosdaq large ordinary
  { symbol: '247540', venue: 'kosdaq' },
  { symbol: '086520', venue: 'kosdaq' },
  { symbol: '196170', venue: 'kosdaq' },
  { symbol: '141080', venue: 'kosdaq' },
  { symbol: '028300', venue: 'kosdaq' },
  { symbol: '068760', venue: 'kosdaq' },
  { symbol: '403870', venue: 'kosdaq' },
  { symbol: '214150', venue: 'kosdaq' },
  { symbol: '357780', venue: 'kosdaq' },
  { symbol: '039030', venue: 'kosdaq' },
  { symbol: '145020', venue: 'kosdaq' },
  { symbol: '240810', venue: 'kosdaq' },
  { symbol: '277810', venue: 'kosdaq' },
  { symbol: '310210', venue: 'kosdaq' },
  { symbol: '214370', venue: 'kosdaq' },
  { symbol: '293490', venue: 'kosdaq' },
  { symbol: '263750', venue: 'kosdaq' },
  { symbol: '112040', venue: 'kosdaq' },
  { symbol: '035900', venue: 'kosdaq' },
  { symbol: '041510', venue: 'kosdaq' },
  { symbol: '122870', venue: 'kosdaq' },
  { symbol: '067160', venue: 'kosdaq' },
  { symbol: '058470', venue: 'kosdaq' },
  { symbol: '084370', venue: 'kosdaq' },
  { symbol: '095340', venue: 'kosdaq' },
  { symbol: '064760', venue: 'kosdaq' },
  { symbol: '222080', venue: 'kosdaq' },
  { symbol: '348370', venue: 'kosdaq' },
  { symbol: '253450', venue: 'kosdaq' },
  { symbol: '067310', venue: 'kosdaq' },
  { symbol: '053800', venue: 'kosdaq' },
  { symbol: '086900', venue: 'kosdaq' },
  { symbol: '215000', venue: 'kosdaq' },
  { symbol: '328130', venue: 'kosdaq' },
  { symbol: '462870', venue: 'kosdaq' },
  { symbol: '950130', venue: 'kosdaq' },
  { symbol: '060250', venue: 'kosdaq' },
  { symbol: '078340', venue: 'kosdaq' },
  { symbol: '036930', venue: 'kosdaq' },
  { symbol: '048410', venue: 'kosdaq' },
];

export function yahooSuffixForVenue(venue) {
  return venue === 'kosdaq' ? '.KQ' : '.KS';
}

export function yahooSymbolForVenue(symbol, venue) {
  const code = String(symbol || '')
    .trim()
    .replace(/\.(KS|KQ)$/i, '');
  if (!/^\d{6}$/.test(code)) return '';
  return `${code}${yahooSuffixForVenue(venue)}`;
}

export function venueFromYahooSymbol(yahooSymbol) {
  const y = String(yahooSymbol || '').trim().toUpperCase();
  if (y.endsWith('.KQ')) return 'kosdaq';
  if (y.endsWith('.KS')) return 'kospi';
  return null;
}

/** @returns {Map<string, KrVenue>} */
export function koreaScreenerVenueMap(entries = KOREA_SCREENER_UNIVERSE_ENTRIES) {
  const map = new Map();
  for (const row of entries) {
    const symbol = String(row?.symbol || '')
      .trim()
      .replace(/\.(KS|KQ)$/i, '');
    const venue = row?.venue === 'kosdaq' ? 'kosdaq' : row?.venue === 'kospi' ? 'kospi' : null;
    if (/^\d{6}$/.test(symbol) && venue) map.set(symbol, venue);
  }
  return map;
}

/**
 * Merge venues from list payload ({ venues: { code: venue } } or entries[]).
 * @returns {Map<string, KrVenue>}
 */
export function venuesFromMarketListPayload(payload) {
  const map = new Map();
  const venues = payload?.venues && typeof payload.venues === 'object' ? payload.venues : null;
  if (venues) {
    for (const [raw, v] of Object.entries(venues)) {
      const symbol = String(raw || '')
        .trim()
        .replace(/\.(KS|KQ)$/i, '');
      const venue = v === 'kosdaq' || v === 'kospi' ? v : null;
      if (/^\d{6}$/.test(symbol) && venue) map.set(symbol, venue);
    }
  }
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];
  for (const row of entries) {
    const symbol = String(row?.symbol || '')
      .trim()
      .replace(/\.(KS|KQ)$/i, '');
    const venue = row?.venue === 'kosdaq' || row?.venue === 'kospi' ? row.venue : null;
    if (/^\d{6}$/.test(symbol) && venue) map.set(symbol, venue);
  }
  return map;
}

/** Preferred Yahoo map from venue (overrides wrong .KS/.KQ stored on quotes). */
export function preferredYahooFromVenues(venueBySymbol) {
  const map = {};
  for (const [symbol, venue] of venueBySymbol.entries()) {
    map[symbol] = yahooSymbolForVenue(symbol, venue);
  }
  return map;
}
