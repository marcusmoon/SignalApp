/**
 * 홈 시세 섹션 하단 시총 상위 코인.
 * 별도 섹션 없이 워치리스트 아래 — compact 2 · wide(PC) 3.
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
  marketCap?: number | null;
};

function marketCapValue(coin: AnchorCoinFields): number {
  return typeof coin.marketCap === 'number' && Number.isFinite(coin.marketCap) ? coin.marketCap : -1;
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

/**
 * 시총 상위 코인 선택. 목록 순서가 시총순이 아니어도 marketCap으로 정렬.
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
  const ranked = [...coins].sort((a, b) => {
    const diff = marketCapValue(b) - marketCapValue(a);
    if (diff !== 0) return diff;
    return normalizeQuoteSymbol(a.symbol).localeCompare(normalizeQuoteSymbol(b.symbol));
  });

  const seen = new Set<string>();
  const rows: T[] = [];
  for (const coin of ranked) {
    const key = normalizeQuoteSymbol(coin.symbol);
    if (!key || seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    rows.push(coin);
    if (rows.length >= max) break;
  }
  return rows;
}
