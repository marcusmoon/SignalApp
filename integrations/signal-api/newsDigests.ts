import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiNewsDigestItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import {
  buildSignalNewsDigestsCacheKey,
  peekSignalNewsDigestsCache,
  storeSignalNewsDigestsCache,
} from '@/integrations/signal-api/cache/newsDigestsCache';

export type SignalNewsDigestPage = {
  items: SignalApiNewsDigestItem[];
  meta: SignalNewsListMeta;
};

function normalizeMeta(
  json: { data?: SignalApiNewsDigestItem[]; meta?: Partial<SignalNewsListMeta> },
  params: { limit?: number; offset?: number },
): SignalNewsListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const limit = Number(json.meta?.limit) || Number(params.limit) || rows.length || 4;
  const offset = Number(json.meta?.offset) || Number(params.offset) || 0;
  const total = Number.isFinite(Number(json.meta?.total)) ? Number(json.meta?.total) : rows.length;
  const hasMore =
    typeof json.meta?.hasMore === 'boolean'
      ? json.meta.hasMore
      : offset + rows.length < total;
  const nextOffset =
    json.meta?.nextOffset != null
      ? json.meta.nextOffset
      : hasMore
        ? offset + rows.length
        : null;
  return { limit, offset, total, hasMore, nextOffset };
}

export async function fetchSignalNewsDigests(
  params: {
    category?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
    batches?: number;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalNewsDigestPage> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalNewsDigestsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalNewsDigestsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiNewsDigestItem[]; meta?: Partial<SignalNewsListMeta> }>(
    '/v1/news-digests',
    params,
    { timeoutMs: 4000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  const value = {
    items: rows,
    meta: normalizeMeta({ ...json, data: rows }, params),
  };
  if (cacheMode !== 'bypass') storeSignalNewsDigestsCache(cacheKey, value);
  return value;
}
