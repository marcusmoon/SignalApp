/**
 * 홈 시세 레이어 라인 as-of (`지수 (금 종가)`).
 * 주식·지수는 주말·마감 후 상대시간 대신 종가 라벨, 코인만 있으면 상대시간.
 */

export type WatchlistHomeAsOfQuote = {
  segment?: string | null;
  quoteTime?: string | null;
  fetchedAt?: string | null;
};

export type WatchlistHomeAsOfRow = {
  quote: WatchlistHomeAsOfQuote | null;
};

export type WatchlistHomeAsOf =
  | { mode: 'relative'; iso: string }
  | { mode: 'today_close' }
  | { mode: 'prior_close'; ymd: string };

/** 같은 날·최근이면 상대시간, 이후는 종가 라벨 */
export const WATCHLIST_ASOF_FRESH_MS = 6 * 60 * 60 * 1000;

/**
 * FX prints often sit hours old while Yahoo already shows Closed.
 * Prefer 종가 labels sooner than equities (avoid “9시간 전”).
 */
export const FX_ASOF_FRESH_MS = 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function localYmdFromInstant(isoOrDate: string | Date): string | null {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (!Number.isFinite(date.getTime())) return null;
  // 기기 로컬 캘린더일 (DATE-TIME.md 표시 규칙)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function isLocalWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 토·일이면 직전 평일로 당김 (종가 기준일) */
export function previousWeekdayYmd(from: Date): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (isLocalWeekend(d)) {
    d.setDate(d.getDate() - 1);
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function quoteAsOfIso(quote: WatchlistHomeAsOfQuote | null | undefined): string | null {
  if (!quote) return null;
  const quoteTime = String(quote.quoteTime || '').trim();
  if (quoteTime) return quoteTime;
  const fetchedAt = String(quote.fetchedAt || '').trim();
  return fetchedAt || null;
}

export function isCoinQuote(quote: WatchlistHomeAsOfQuote | null | undefined): boolean {
  return String(quote?.segment || '')
    .trim()
    .toLowerCase() === 'coin';
}

export function isFxQuote(quote: WatchlistHomeAsOfQuote | null | undefined): boolean {
  return String(quote?.segment || '')
    .trim()
    .toLowerCase() === 'fx';
}

/** 주식이 있으면 주식만, 없으면 코인 — 섹션 as-of 후보 */
export function pickWatchlistAsOfPool(rows: readonly WatchlistHomeAsOfRow[]): WatchlistHomeAsOfQuote[] {
  const quotes = rows.map((row) => row.quote).filter((quote): quote is WatchlistHomeAsOfQuote => Boolean(quote));
  const equities = quotes.filter((quote) => !isCoinQuote(quote));
  return equities.length > 0 ? equities : quotes.filter(isCoinQuote);
}

export function newestAsOfIso(quotes: readonly WatchlistHomeAsOfQuote[]): string | null {
  let bestMs = Number.NEGATIVE_INFINITY;
  let bestIso: string | null = null;
  for (const quote of quotes) {
    const iso = quoteAsOfIso(quote);
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms) || ms <= bestMs) continue;
    bestMs = ms;
    bestIso = iso;
  }
  return bestIso;
}

export function resolveWatchlistHomeAsOf(
  rows: readonly WatchlistHomeAsOfRow[],
  now: Date = new Date(),
  freshMs: number = WATCHLIST_ASOF_FRESH_MS,
): WatchlistHomeAsOf | null {
  const pool = pickWatchlistAsOfPool(rows);
  if (pool.length === 0) return null;

  const iso = newestAsOfIso(pool);
  if (!iso) return null;

  const asOf = new Date(iso);
  if (!Number.isFinite(asOf.getTime())) return null;

  const poolIsCoinOnly = pool.every(isCoinQuote);
  if (poolIsCoinOnly) {
    return { mode: 'relative', iso };
  }

  const poolIsFxOnly = pool.length > 0 && pool.every(isFxQuote);
  const effectiveFreshMs = poolIsFxOnly ? Math.min(freshMs, FX_ASOF_FRESH_MS) : freshMs;

  // 주식·FX: 주말이면 종가 라벨 (상대시간 = 파이프라인 지연처럼 오해됨)
  if (isLocalWeekend(now)) {
    return { mode: 'prior_close', ymd: previousWeekdayYmd(asOf) };
  }

  const asOfYmd = localYmdFromInstant(asOf);
  const nowYmd = localYmdFromInstant(now);
  if (!asOfYmd || !nowYmd) return { mode: 'relative', iso };

  if (asOfYmd === nowYmd) {
    const ageMs = now.getTime() - asOf.getTime();
    if (ageMs >= 0 && ageMs <= effectiveFreshMs) {
      return { mode: 'relative', iso };
    }
    return { mode: 'today_close' };
  }

  return { mode: 'prior_close', ymd: previousWeekdayYmd(asOf) };
}

/** Home quote tile — show Close under the name when session print is stale/closed. Coins never. */
export function isWatchlistQuoteClosed(
  quote: WatchlistHomeAsOfQuote | null | undefined,
  now: Date = new Date(),
  freshMs: number = WATCHLIST_ASOF_FRESH_MS,
): boolean {
  if (!quote || isCoinQuote(quote)) return false;
  const resolved = resolveWatchlistHomeAsOf([{ quote }], now, freshMs);
  return resolved?.mode === 'today_close' || resolved?.mode === 'prior_close';
}
