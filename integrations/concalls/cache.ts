import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import type { ConcallSummary } from '@/types/signal';

/** Same filter re-entry / tab switch — memory cache TTL for conference-call summaries */
export const CONCALL_CACHE_TTL_MS = 15 * 60 * 1000;

type Entry = { items: ConcallSummary[]; expiresAt: number };

const cache = new Map<string, Entry>();

export type ConcallCacheKeyInput = {
  symbolCap: number;
  scope: CalendarConcallScope;
  watchSorted: readonly string[];
  fiscalYear: number | null;
  fiscalQuarter: number;
  rollingPastDays?: number;
  rollingFutureDays?: number;
};

export function buildConcallCacheKey(p: ConcallCacheKeyInput): string {
  const watchPart = p.scope === 'watch' ? p.watchSorted.join(',') : '';
  const fy = p.fiscalYear == null ? 'roll' : String(p.fiscalYear);
  const roll =
    p.fiscalYear == null ? `${p.rollingPastDays ?? 14}:${p.rollingFutureDays ?? 21}` : 'na';
  return `v1|${p.scope}|${watchPart}|${fy}|${p.fiscalQuarter}|${p.symbolCap}|${roll}`;
}

export function peekConcallCache(key: string): ConcallSummary[] | null {
  const e = cache.get(key);
  if (e && Date.now() < e.expiresAt) {
    return e.items;
  }
  return null;
}

export function storeConcallCache(key: string, items: ConcallSummary[]): void {
  cache.set(key, { items, expiresAt: Date.now() + CONCALL_CACHE_TTL_MS });
}

export function deleteConcallCache(key: string): void {
  cache.delete(key);
}

export function clearConcallCache(): void {
  cache.clear();
}
