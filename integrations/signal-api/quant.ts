import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiQuantSignal } from '@/integrations/signal-api/types';

export async function fetchSignalQuantSignals(params: {
  symbols?: readonly string[];
  limit?: number;
  segment?: string;
} = {}): Promise<SignalApiQuantSignal[]> {
  const json = await signalApi<{ data: SignalApiQuantSignal[] }>(
    '/v1/quant-signals',
    {
      symbols: params.symbols?.join(','),
      limit: params.limit ?? 10,
      segment: params.segment,
    },
    { timeoutMs: 5000, attempts: 1 },
  );
  return json.data;
}
