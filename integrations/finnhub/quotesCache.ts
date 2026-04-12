import type { FinnhubQuote } from '@/integrations/finnhub/types';

/** Same interval as quotes tab refresh — keeps poll vs cache aligned */
export const QUOTES_POLL_INTERVAL_MS = 30 * 1000;

export const QUOTES_CACHE_TTL_MS = QUOTES_POLL_INTERVAL_MS;

export const MCAP_SYMBOLS_ORDER_TTL_MS = 10 * 60 * 1000;

export type QuoteCacheRow = {
  symbol: string;
  name?: string;
  quote: FinnhubQuote | null;
  error?: string;
};

type Entry = { rows: QuoteCacheRow[]; expiresAt: number; storedAt: number };

const cache = new Map<string, Entry>();

export type QuoteCacheHit = { rows: QuoteCacheRow[]; storedAtMs: number; expiresAtMs: number };

type McapOrderEntry = { symbols: string[]; expiresAt: number };
const mcapSymbolsOrderByLimit = new Map<number, McapOrderEntry>();

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
  if (segment === 'watch') return `watch|v2|${[...symbolsSorted].join(',')}`;
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
