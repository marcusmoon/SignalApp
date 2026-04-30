import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiConcall } from '@/integrations/signal-api/types';

export async function fetchSignalConcalls(params?: {
  symbol?: string;
  fiscalYear?: number;
  fiscalQuarter?: number;
  from?: string;
  to?: string;
  includeTranscript?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<SignalApiConcall[]> {
  const json = await signalApi<{ data: SignalApiConcall[] }>('/v1/concalls', {
    symbol: params?.symbol,
    fiscalYear: params?.fiscalYear,
    fiscalQuarter: params?.fiscalQuarter,
    from: params?.from,
    to: params?.to,
    includeTranscript: params?.includeTranscript ? 1 : undefined,
    page: params?.page,
    pageSize: params?.pageSize ?? 30,
  });
  return json.data;
}
