import type { SignalApiCommunityPost, SignalCommunityListMeta } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

export { SIGNAL_FEED_CACHE_TTL_MS as SIGNAL_COMMUNITY_CACHE_TTL_MS };

type CommunityCacheValue = { items: SignalApiCommunityPost[]; meta: SignalCommunityListMeta };
const communityCache = new Map<string, { value: CommunityCacheValue; expiresAt: number }>();

export function buildSignalCommunityCacheKey(params?: {
  source?: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): string {
  const p = {
    source: String(params?.source || 'all').trim(),
    q: String(params?.q || '').trim(),
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    limit: Number(params?.limit) || 0,
    offset: Number(params?.offset) || 0,
  };
  return `community|${p.source}|${p.q}|${p.from}|${p.to}|${p.limit}|${p.offset}`;
}

export function peekSignalCommunityCache(key: string): CommunityCacheValue | null {
  return peekCache(communityCache, key);
}

export function storeSignalCommunityCache(key: string, value: CommunityCacheValue): void {
  storeCache(communityCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalCommunityCache(): void {
  communityCache.clear();
}
