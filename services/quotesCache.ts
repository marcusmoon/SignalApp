import type { FinnhubQuote } from '@/services/finnhub';

/** 시세 탭 자동 갱신 간격(`app/(tabs)/quotes.tsx`)과 동일 — 주기·캐시 유효 시간이 어긋나지 않게 */
export const QUOTES_POLL_INTERVAL_MS = 30 * 1000;

/** 실시간 시세(관심·인기·시총·코인) 메모리 캐시 TTL — 갱신 주기와 맞춤 */
export const QUOTES_CACHE_TTL_MS = QUOTES_POLL_INTERVAL_MS;

/**
 * 시총순 탭: Finnhub profile2로 순위를 잡는 구간이 무겁기 때문에, 심볼 순서만 별도 TTL로 메모리 캐시.
 * (시세 quote 캐시와는 별개 — 새로고침 시 순위도 다시 계산하려면 pull 시 이 캐시를 쓰지 않음)
 */
export const MCAP_SYMBOLS_ORDER_TTL_MS = 10 * 60 * 1000;

export type QuoteCacheRow = {
  symbol: string;
  name?: string;
  quote: FinnhubQuote | null;
  error?: string;
};

type Entry = { rows: QuoteCacheRow[]; expiresAt: number; storedAt: number };

const cache = new Map<string, Entry>();

/** 캐시 히트 시 행·저장 시각·만료 시각(TTL 끝 자동 갱신용) */
export type QuoteCacheHit = { rows: QuoteCacheRow[]; storedAtMs: number; expiresAtMs: number };

type McapOrderEntry = { symbols: string[]; expiresAt: number };
const mcapSymbolsOrderByLimit = new Map<number, McapOrderEntry>();

/** 시총 상위 N개 심볼 순서(프로필 조회 결과) — TTL 내 재사용 */
export function peekMcapSymbolsOrder(mcapMax: number): string[] | null {
  const e = mcapSymbolsOrderByLimit.get(mcapMax);
  if (e && Date.now() < e.expiresAt) return e.symbols;
  return null;
}

export function storeMcapSymbolsOrder(mcapMax: number, symbols: string[]): void {
  mcapSymbolsOrderByLimit.set(mcapMax, {
    symbols,
    expiresAt: Date.now() + MCAP_SYMBOLS_ORDER_TTL_MS,
  });
}

export function clearMcapSymbolsOrderCache(): void {
  mcapSymbolsOrderByLimit.clear();
}

export function buildQuotesCacheKey(
  segment: 'watch' | 'popular' | 'mcap' | 'coin',
  symbolsSorted: readonly string[],
  coinLimit?: number,
): string {
  if (segment === 'coin') return `coin|n${coinLimit ?? 20}`;
  return `${segment}|${[...symbolsSorted].join(',')}`;
}

export function peekQuotes(key: string): QuoteCacheHit | null {
  const e = cache.get(key);
  if (!e || Date.now() >= e.expiresAt) return null;
  const storedAtMs =
    typeof e.storedAt === 'number' && Number.isFinite(e.storedAt)
      ? e.storedAt
      : e.expiresAt - QUOTES_CACHE_TTL_MS;
  return { rows: e.rows, storedAtMs, expiresAtMs: e.expiresAt };
}

export function storeQuotes(key: string, rows: QuoteCacheRow[]): void {
  const storedAt = Date.now();
  cache.set(key, { rows, storedAt, expiresAt: storedAt + QUOTES_CACHE_TTL_MS });
}

export function clearQuotesCache(): void {
  cache.clear();
  mcapSymbolsOrderByLimit.clear();
}
