import type { NewsSegmentKey } from '@/constants/newsSegment';
import type { SignalApiNewsItem } from '@/integrations/signal-api/types';
import { loadKoreaNewsExtraKeywords } from '@/services/newsKoreaKeywordsPreference';

/** News raw payload — memory cache TTL (legacy tab cache; items are Signal API rows) */
export const NEWS_CACHE_TTL_MS = 5 * 60 * 1000;

type Entry = { raw: SignalApiNewsItem[]; expiresAt: number };
const cache = new Map<string, Entry>();

export async function buildNewsCacheKey(segment: NewsSegmentKey): Promise<string> {
  if (segment === 'korea') {
    const kw = await loadKoreaNewsExtraKeywords();
    return `korea|${[...kw].sort((a, b) => a.localeCompare(b)).join('\0')}`;
  }
  return segment;
}

export function peekNewsCache(key: string): SignalApiNewsItem[] | null {
  const e = cache.get(key);
  if (e && Date.now() < e.expiresAt) return e.raw;
  return null;
}

export function storeNewsCache(key: string, raw: SignalApiNewsItem[]): void {
  cache.set(key, { raw, expiresAt: Date.now() + NEWS_CACHE_TTL_MS });
}

export function clearNewsCache(): void {
  cache.clear();
}
