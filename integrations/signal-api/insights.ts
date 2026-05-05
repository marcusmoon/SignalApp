import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiInsight } from '@/integrations/signal-api/types';

export async function fetchSignalInsights(
  params: {
    symbol?: string;
    level?: string;
    kind?: string;
    pushCandidate?: boolean;
    limit?: number;
  } = {},
): Promise<SignalApiInsight[]> {
  const json = await signalApi<{ data: SignalApiInsight[] }>('/v1/insights', {
    symbol: params.symbol,
    level: params.level,
    kind: params.kind,
    pushCandidate: params.pushCandidate ? 'true' : undefined,
    limit: params.limit ?? 8,
  });
  return Array.isArray(json.data) ? json.data : [];
}
