import type { SignalApiNewsDigestItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

type NewsDigestCacheValue = { items: SignalApiNewsDigestItem[]; meta: SignalNewsListMeta };
const digestsCache = new Map<string, { value: NewsDigestCacheValue; expiresAt: number }>();

export function buildSignalNewsDigestsCacheKey(params?: {
  category?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  batches?: number;
  locale?: string;
}): string {
  const p = {
    category: String(params?.category || '').trim(),
    limit: Number(params?.limit) || 0,
    offset: Number(params?.offset) || 0,
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    batches: Number(params?.batches) || 0,
    locale: String(params?.locale || '').trim() || 'ko',
  };
  return `news-digests|${p.category}|${p.limit}|${p.offset}|${p.from}|${p.to}|${p.batches}|${p.locale}`;
}

export function peekSignalNewsDigestsCache(key: string): NewsDigestCacheValue | null {
  return peekCache(digestsCache, key);
}

export function storeSignalNewsDigestsCache(key: string, value: NewsDigestCacheValue): void {
  storeCache(digestsCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalNewsDigestsCache(): void {
  digestsCache.clear();
}
