import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiCommunityPost, SignalCommunityListMeta, SignalCommunityPage } from '@/integrations/signal-api/types';
import type { CommunitySourceFilter } from '@/constants/communitySources';

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
): Promise<SignalCommunityPage> {
  const limit = params?.limit ?? 30;
  const offset = params?.offset ?? 0;
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
  return { items: rows, meta };
}

export async function fetchSignalCommunitySources(): Promise<string[]> {
  const json = await signalApi<{ data: string[] }>('/v1/community/sources', undefined, {
    timeoutMs: 5000,
    attempts: 1,
  });
  return Array.isArray(json.data) ? json.data : [];
}
