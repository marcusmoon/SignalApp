/**
 * 홈 시세 레이어 as-of (`지수 … [종가]`).
 * 레이어 Close는 풀의 모든 지수·주식·FX가 종가일 때만.
 * 타일 Close는 레이어가 Close가 아닐 때, 개별 마감 종목에만.
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

export function isWatchlistAsOfCloseMode(
  resolved: WatchlistHomeAsOf | null | undefined,
): boolean {
  return resolved?.mode === 'today_close' || resolved?.mode === 'prior_close';
}

/** 주식이 있으면 주식만, 없으면 코인 — 섹션 as-of 후보 */
export function pickWatchlistAsOfPool(rows: readonly WatchlistHomeAsOfRow[]): WatchlistHomeAsOfQuote[] {
  const equities: WatchlistHomeAsOfQuote[] = [];
  const coins: WatchlistHomeAsOfQuote[] = [];
  for (const row of rows) {
    const quote = row.quote;
    if (!quote) continue;
    if (isCoinQuote(quote)) coins.push(quote);
    else equities.push(quote);
  }
  return equities.length > 0 ? equities : coins;
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

/** Single quote session label (coin → relative; equity/FX → close or relative). */
export function resolveWatchlistQuoteAsOf(
  quote: WatchlistHomeAsOfQuote,
  now: Date = new Date(),
  freshMs: number = WATCHLIST_ASOF_FRESH_MS,
): WatchlistHomeAsOf | null {
  const iso = quoteAsOfIso(quote);
  if (!iso) return null;

  const asOf = new Date(iso);
  if (!Number.isFinite(asOf.getTime())) return null;

  if (isCoinQuote(quote)) {
    return { mode: 'relative', iso };
  }

  const effectiveFreshMs = isFxQuote(quote) ? Math.min(freshMs, FX_ASOF_FRESH_MS) : freshMs;

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

/**
 * Layer as-of. Equity/FX Close only when every quote in the pool is closed;
 * otherwise relative time from the newest open print.
 * Single pass over the pool (no re-resolve of the newest quote).
 */
export function resolveWatchlistHomeAsOf(
  rows: readonly WatchlistHomeAsOfRow[],
  now: Date = new Date(),
  freshMs: number = WATCHLIST_ASOF_FRESH_MS,
): WatchlistHomeAsOf | null {
  const pool = pickWatchlistAsOfPool(rows);
  if (pool.length === 0) return null;

  if (pool.every(isCoinQuote)) {
    const iso = newestAsOfIso(pool);
    return iso ? { mode: 'relative', iso } : null;
  }

  let allClosed = true;
  let newestAnyMs = Number.NEGATIVE_INFINITY;
  let newestAnyResolved: WatchlistHomeAsOf | null = null;
  let newestOpenMs = Number.NEGATIVE_INFINITY;
  let newestOpenIso: string | null = null;

  for (const quote of pool) {
    const iso = quoteAsOfIso(quote);
    if (!iso) continue;
    const ms = new Date(iso).getTime();
    if (!Number.isFinite(ms)) continue;
    const resolved = resolveWatchlistQuoteAsOf(quote, now, freshMs);
    if (!resolved) continue;

    if (ms > newestAnyMs) {
      newestAnyMs = ms;
      newestAnyResolved = resolved;
    }

    if (isWatchlistAsOfCloseMode(resolved)) continue;
    allClosed = false;
    if (ms > newestOpenMs) {
      newestOpenMs = ms;
      newestOpenIso = iso;
    }
  }

  if (!newestAnyResolved) return null;
  if (allClosed) return newestAnyResolved;
  // Mixed: prefer newest open print for the relative header label.
  if (!newestOpenIso) return null;
  return { mode: 'relative', iso: newestOpenIso };
}

/** Home quote tile — closed session print. Coins never. */
export function isWatchlistQuoteClosed(
  quote: WatchlistHomeAsOfQuote | null | undefined,
  now: Date = new Date(),
  freshMs: number = WATCHLIST_ASOF_FRESH_MS,
): boolean {
  if (!quote || isCoinQuote(quote)) return false;
  return isWatchlistAsOfCloseMode(resolveWatchlistQuoteAsOf(quote, now, freshMs));
}
