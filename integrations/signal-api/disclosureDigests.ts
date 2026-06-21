import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiDisclosureDigestItem, SignalNewsListMeta } from '@/integrations/signal-api/types';

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

export async function fetchSignalDisclosureDigests(
  params: {
    market?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
    batches?: number;
  } = {},
): Promise<SignalDisclosureDigestPage> {
  const json = await signalApi<{
    data: SignalApiDisclosureDigestItem[];
    meta?: Partial<SignalNewsListMeta>;
  }>('/v1/disclosure-digests', params, { timeoutMs: 4000, attempts: 1 });
  const rows = Array.isArray(json.data) ? json.data : [];
  return {
    items: rows,
    meta: normalizeMeta({ ...json, data: rows }, params),
  };
}
