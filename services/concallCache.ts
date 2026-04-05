import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import type { ConcallSummary } from '@/types/signal';

/** 동일 필터로 재진입·탭 전환 시 API·요약 호출을 줄이기 위한 TTL (메모리 캐시) */
export const CONCALL_CACHE_TTL_MS = 15 * 60 * 1000;

type Entry = { items: ConcallSummary[]; expiresAt: number };

const cache = new Map<string, Entry>();

export type ConcallCacheKeyInput = {
  /** pickSymbolsFromRows 상한 — FY 조회 시 10, 롤링 시 maxItemsParam */
  symbolCap: number;
  scope: CalendarConcallScope;
  /** scope가 watch일 때만 의미 있음 — 정규화된 티커, 정렬 */
  watchSorted: readonly string[];
  /** null이면 롤링 윈도(최근) 모드 */
  fiscalYear: number | null;
  fiscalQuarter: number;
};

export function buildConcallCacheKey(p: ConcallCacheKeyInput): string {
  const watchPart = p.scope === 'watch' ? p.watchSorted.join(',') : '';
  const fy = p.fiscalYear == null ? 'roll' : String(p.fiscalYear);
  return `v1|${p.scope}|${watchPart}|${fy}|${p.fiscalQuarter}|${p.symbolCap}`;
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
