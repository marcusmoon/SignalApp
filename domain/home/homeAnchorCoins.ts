/**
 * 홈 관심 종목 섹션 하단 고정 코인 (BTC·ETH).
 * 별도 섹션 없이 워치리스트 아래에만 붙인다.
 */

export const HOME_ANCHOR_COIN_SYMBOLS = ['BTC', 'ETH'] as const;

export type HomeAnchorCoinSymbol = (typeof HOME_ANCHOR_COIN_SYMBOLS)[number];

export function normalizeQuoteSymbol(symbol: string | null | undefined): string {
  return String(symbol || '')
    .trim()
    .toUpperCase();
}

/** 워치리스트에 이미 있으면 앵커 행에서 제외 (중복 타일 방지) */
export function filterHomeAnchorCoinsNotInWatchlist<T extends { symbol: string }>(
  anchors: readonly T[],
  watchlistSymbols: readonly string[],
): T[] {
  const watch = new Set(watchlistSymbols.map(normalizeQuoteSymbol).filter(Boolean));
  return anchors.filter((row) => {
    const key = normalizeQuoteSymbol(row.symbol);
    return Boolean(key) && !watch.has(key);
  });
}

export function pickHomeAnchorCoinsFromList<T extends { symbol?: string | null }>(
  coins: readonly T[],
  symbols: readonly string[] = HOME_ANCHOR_COIN_SYMBOLS,
): T[] {
  const bySymbol = new Map<string, T>();
  for (const coin of coins) {
    const key = normalizeQuoteSymbol(coin.symbol);
    if (!key || bySymbol.has(key)) continue;
    bySymbol.set(key, coin);
  }
  const rows: T[] = [];
  for (const symbol of symbols) {
    const hit = bySymbol.get(normalizeQuoteSymbol(symbol));
    if (hit) rows.push(hit);
  }
  return rows;
}
