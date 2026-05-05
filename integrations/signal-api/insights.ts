import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiInsight } from '@/integrations/signal-api/types';

export type FetchSignalInsightsMeta = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type FetchSignalInsightsResult = {
  items: SignalApiInsight[];
  meta: FetchSignalInsightsMeta;
};

export async function fetchSignalInsights(
  params: {
    symbol?: string;
    level?: string;
    kind?: string;
    pushCandidate?: boolean;
    limit?: number;
    offset?: number;
  } = {},
): Promise<FetchSignalInsightsResult> {
  const json = await signalApi<{ data: SignalApiInsight[]; meta?: FetchSignalInsightsMeta }>('/v1/insights', {
    symbol: params.symbol,
    level: params.level,
    kind: params.kind,
    pushCandidate: params.pushCandidate ? 'true' : undefined,
    limit: params.limit ?? 8,
    offset: params.offset ?? 0,
  });
  const items = Array.isArray(json.data) ? json.data : [];
  const meta =
    json.meta && typeof json.meta.total === 'number'
      ? json.meta
      : {
          total: items.length,
          limit: params.limit ?? items.length,
          offset: params.offset ?? 0,
          hasMore: false,
        };
  return { items, meta };
}
