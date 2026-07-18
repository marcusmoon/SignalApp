import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiDisclosureDigestItem, SignalNewsListMeta } from '@/integrations/signal-api/types';
import {
  buildSignalDisclosureDigestsCacheKey,
  peekSignalDisclosureDigestsCache,
  storeSignalDisclosureDigestsCache,
} from '@/integrations/signal-api/cache/disclosureDigestsCache';

export type SignalDisclosureDigestPage = {
  items: SignalApiDisclosureDigestItem[];
  meta: SignalNewsListMeta;
};

function normalizeMeta(
  json: { data?: SignalApiDisclosureDigestItem[]; meta?: Partial<SignalNewsListMeta> },
  params: { limit?: number; offset?: number },
): SignalNewsListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const limit = Number(json.meta?.limit) || Number(params.limit) || rows.length || 4;
  const offset = Number(json.meta?.offset) || Number(params.offset) || 0;
  const total = Number.isFinite(Number(json.meta?.total)) ? Number(json.meta?.total) : rows.length;
  const hasMore =
    typeof json.meta?.hasMore === 'boolean' ? json.meta.hasMore : offset + rows.length < total;
  const nextOffset =
    json.meta?.nextOffset != null ? json.meta.nextOffset : hasMore ? offset + rows.length : null;
  return { limit, offset, total, hasMore, nextOffset };
}

export async function fetchSignalDisclosureDigestById(
  id: string,
  options?: { cacheMode?: SignalCacheMode; locale?: string },
): Promise<SignalApiDisclosureDigestItem | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  const page = await fetchSignalDisclosureDigests(
    { id: cleanId, limit: 1, locale: options?.locale },
    options,
  );
  return page.items[0] ?? null;
}

export async function fetchSignalDisclosureDigests(
  params: {
    id?: string;
    market?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
    batches?: number;
    locale?: string;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalDisclosureDigestPage> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalDisclosureDigestsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalDisclosureDigestsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{
    data: SignalApiDisclosureDigestItem[];
    meta?: Partial<SignalNewsListMeta>;
  }>('/v1/disclosure-digests', params, { timeoutMs: 4000, attempts: 1 });
  const rows = Array.isArray(json.data) ? json.data : [];
  const value = {
    items: rows,
    meta: normalizeMeta({ ...json, data: rows }, params),
  };
  if (cacheMode !== 'bypass') storeSignalDisclosureDigestsCache(cacheKey, value);
  return value;
}
