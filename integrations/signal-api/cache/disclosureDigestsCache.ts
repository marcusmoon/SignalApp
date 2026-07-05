import type { SignalApiDisclosureDigestItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

type DisclosureDigestCacheValue = { items: SignalApiDisclosureDigestItem[]; meta: SignalNewsListMeta };
const digestsCache = new Map<string, { value: DisclosureDigestCacheValue; expiresAt: number }>();

export function buildSignalDisclosureDigestsCacheKey(params?: {
  market?: string;
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  batches?: number;
}): string {
  const p = {
    market: String(params?.market || '').trim(),
    limit: Number(params?.limit) || 0,
    offset: Number(params?.offset) || 0,
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    batches: Number(params?.batches) || 0,
  };
  return `disclosure-digests|${p.market}|${p.limit}|${p.offset}|${p.from}|${p.to}|${p.batches}`;
}

export function peekSignalDisclosureDigestsCache(key: string): DisclosureDigestCacheValue | null {
  return peekCache(digestsCache, key);
}

export function storeSignalDisclosureDigestsCache(key: string, value: DisclosureDigestCacheValue): void {
  storeCache(digestsCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalDisclosureDigestsCache(): void {
  digestsCache.clear();
}
