import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiDisclosure, SignalNewsListMeta } from '@/integrations/signal-api/types';

export type SignalDisclosuresPage = {
  items: SignalApiDisclosure[];
  meta: SignalNewsListMeta;
};

function normalizeMeta(
  json: { data?: SignalApiDisclosure[]; meta?: Partial<SignalNewsListMeta> },
  params: { limit?: number; offset?: number },
): SignalNewsListMeta {
  const rows = Array.isArray(json.data) ? json.data : [];
  const limit = Number(json.meta?.limit) || Number(params.limit) || rows.length || 30;
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

export async function fetchSignalDisclosures(
  params: {
    market?: string;
    provider?: string;
    formType?: string;
    symbol?: string;
    symbols?: string;
    q?: string;
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  } = {},
  _options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalDisclosuresPage> {
  const json = await signalApi<{ data: SignalApiDisclosure[]; meta?: Partial<SignalNewsListMeta> }>(
    '/v1/disclosures',
    params,
    { timeoutMs: 6000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  return { items: rows, meta: normalizeMeta({ ...json, data: rows }, params) };
}

export async function fetchSignalDisclosure(id: string): Promise<SignalApiDisclosure | null> {
  const key = String(id || '').trim();
  if (!key) return null;
  const json = await signalApi<{ data?: SignalApiDisclosure }>(`/v1/disclosures/${encodeURIComponent(key)}`);
  return json.data || null;
}
