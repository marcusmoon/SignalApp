/**
 * Combined symbol list for a single home quotes fetch (watchlist + indices + FX).
 */
export function buildHomeQuoteBatchSymbols(
  watchlistSymbols: readonly string[],
  indexSymbols: readonly string[],
  fxSymbols: readonly string[],
): string[] {
  return [...new Set([...watchlistSymbols, ...indexSymbols, ...fxSymbols])];
}
