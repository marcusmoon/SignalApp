import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost, SignalCommunityListMeta, SignalCommunityPage } from '@/integrations/signal-api/types';
import type { CommunitySourceFilter } from '@/constants/communitySources';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import {
  buildSignalCommunityCacheKey,
  peekSignalCommunityCache,
  storeSignalCommunityCache,
} from '@/integrations/signal-api/cache/communityCache';

function normalizeCommunityMeta(
  json: { data?: SignalApiCommunityPost[]; meta?: Partial<SignalCommunityListMeta> },
  params: { limit?: number; offset?: number },
): SignalCommunityListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const m = json.meta;
  const limit = Number(m?.limit) || Number(params.limit) || rows.length || 30;
  const offset = Number(m?.offset) || Number(params.offset) || 0;
  const total = Number.isFinite(Number(m?.total)) ? Number(m?.total) : rows.length;
  const hasMore = typeof m?.hasMore === 'boolean' ? m.hasMore : offset + rows.length < total;
  const nextOffset = m?.nextOffset != null ? m.nextOffset : hasMore ? offset + rows.length : null;
  return { limit, offset, total, hasMore, nextOffset };
}

export async function fetchSignalCommunity(
  params?: {
    source?: CommunitySourceFilter;
    q?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  },
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalCommunityPage> {
  const limit = params?.limit ?? 30;
  const offset = params?.offset ?? 0;
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalCommunityCacheKey({
    source: params?.source,
    q: params?.q,
    from: params?.from,
    to: params?.to,
    limit,
    offset,
  });
  if (cacheMode !== 'bypass') {
    const hit = peekSignalCommunityCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{
    data: SignalApiCommunityPost[];
    meta?: Partial<SignalCommunityListMeta>;
  }>(
    '/v1/community',
    {
      source: params?.source && params.source !== 'all' ? params.source : undefined,
      q: params?.q,
      from: params?.from,
      to: params?.to,
      limit,
      offset,
    },
    { timeoutMs: 8000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  const meta = normalizeCommunityMeta({ ...json, data: rows }, { limit, offset });
  const value = { items: rows, meta };
  if (cacheMode !== 'bypass') storeSignalCommunityCache(cacheKey, value);
  return value;
}

export async function fetchSignalCommunitySources(): Promise<string[]> {
  const json = await signalApi<{ data: string[] }>('/v1/community/sources', undefined, {
    timeoutMs: 5000,
    attempts: 1,
  });
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchSignalCommunityPost(id: string): Promise<SignalApiCommunityPost | null> {
  const key = String(id || '').trim();
  if (!key) return null;
  const json = await signalApi<{ data?: SignalApiCommunityPost }>(`/v1/community/${encodeURIComponent(key)}`, undefined, {
    timeoutMs: 8000,
    attempts: 1,
  });
  return json.data || null;
}
