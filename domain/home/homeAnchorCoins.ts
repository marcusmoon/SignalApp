/**
 * 홈 시세 섹션 하단 코인 앵커.
 * Admin `crypto_symbols` 순(`/v1/coins` listPosition) — compact 2 · wide(PC) 3.
 * 별도 섹션 없이 워치리스트 아래.
 */

export const HOME_ANCHOR_COIN_COUNT_COMPACT = 2;
export const HOME_ANCHOR_COIN_COUNT_WIDE = 3;
/** 워치리스트 중복 제외 후에도 슬롯을 채우도록 여유분 보관 */
export const HOME_ANCHOR_COIN_FETCH_POOL = 8;

export function homeAnchorCoinCount(useTwoPane: boolean): number {
  return useTwoPane ? HOME_ANCHOR_COIN_COUNT_WIDE : HOME_ANCHOR_COIN_COUNT_COMPACT;
}

export function normalizeQuoteSymbol(symbol: string | null | undefined): string {
  return String(symbol || '')
    .trim()
    .toUpperCase();
}

type AnchorCoinFields = {
  symbol?: string | null;
};

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

/**
 * 큐레이션 목록 순서를 유지해 상위 코인을 고른다.
 * Yahoo chart는 marketCap을 안 주는 경우가 많아 시총 재정렬하지 않는다.
 * `excludeSymbols`에 있는 심볼은 건너뛰고 다음 순위로 채운다.
 */
export function pickHomeAnchorCoinsFromList<T extends AnchorCoinFields>(
  coins: readonly T[],
  limit: number,
  excludeSymbols: readonly string[] = [],
): T[] {
  const max = Math.max(0, Math.floor(limit));
  if (max === 0) return [];

  const exclude = new Set(excludeSymbols.map(normalizeQuoteSymbol).filter(Boolean));
  const seen = new Set<string>();
  const rows: T[] = [];
  for (const coin of coins) {
    const key = normalizeQuoteSymbol(coin.symbol);
    if (!key || seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    rows.push(coin);
    if (rows.length >= max) break;
  }
  return rows;
}
