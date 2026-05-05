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
    symbols?: string[];
    level?: string;
    kind?: string;
    pushCandidate?: boolean;
    date?: 'today' | 'all';
    from?: string;
    to?: string;
    timeZone?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<FetchSignalInsightsResult> {
  const json = await signalApi<{ data: SignalApiInsight[]; meta?: FetchSignalInsightsMeta }>('/v1/insights', {
    symbol: params.symbol,
    symbols: params.symbols && params.symbols.length > 0 ? params.symbols.join(',') : undefined,
    level: params.level,
    kind: params.kind,
    pushCandidate: params.pushCandidate ? 'true' : undefined,
    date: params.date,
    from: params.from,
    to: params.to,
    timeZone: params.timeZone,
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
