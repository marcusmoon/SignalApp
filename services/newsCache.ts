import type { NewsSegmentKey } from '@/constants/newsSegment';
import { loadKoreaNewsExtraKeywords } from '@/services/newsKoreaKeywordsPreference';
import type { FinnhubNewsRaw } from '@/services/finnhub';

/** 뉴스 탭 Finnhub 원문 메모리 캐시 TTL — 과도한 API 호출 완화 */
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;

type Entry = { raw: FinnhubNewsRaw[]; expiresAt: number };

const cache = new Map<string, Entry>();

export async function buildNewsCacheKey(segment: NewsSegmentKey): Promise<string> {
  if (segment === 'korea') {
    const kw = await loadKoreaNewsExtraKeywords();
    return `korea|${[...kw].sort((a, b) => a.localeCompare(b)).join('\0')}`;
  }
  return segment;
}

export function peekNewsCache(key: string): FinnhubNewsRaw[] | null {
  const e = cache.get(key);
  if (e && Date.now() < e.expiresAt) return e.raw;
  return null;
}

export function storeNewsCache(key: string, raw: FinnhubNewsRaw[]): void {
  cache.set(key, { raw, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
}

export function clearNewsCache(): void {
  cache.clear();
}
