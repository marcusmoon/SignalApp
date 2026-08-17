import type { CalendarEvent } from '../../types/signal.ts';

export function normalizeCalendarWatchlistSymbols(symbols: readonly string[]): string[] {
  return [
    ...new Set(
      symbols
        .map((symbol) => String(symbol || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

/** 실적 행은 관심종목(시세·설정 watchlist)만 유지한다. */
export function filterCalendarEarningsToWatchlist<T extends Pick<CalendarEvent, 'type' | 'symbol'>>(
  events: readonly T[],
  watchlistSymbols: readonly string[],
): T[] {
  const watch = new Set(normalizeCalendarWatchlistSymbols(watchlistSymbols));
  if (watch.size === 0) {
    return events.filter((event) => event.type !== 'earnings');
  }
  return events.filter((event) => {
    if (event.type !== 'earnings') return true;
    const symbol = String(event.symbol || '').trim().toUpperCase();
    return Boolean(symbol) && watch.has(symbol);
  });
}
