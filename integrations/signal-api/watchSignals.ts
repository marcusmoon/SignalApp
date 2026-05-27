import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiWatchSignal } from '@/integrations/signal-api/types';

export async function fetchSignalWatchSignals(params: {
  symbols: readonly string[];
  limit?: number;
  date?: string;
  from?: string;
}): Promise<SignalApiWatchSignal[]> {
  const symbols = params.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
  if (symbols.length === 0) return [];
  const json = await signalApi<{ data: SignalApiWatchSignal[] }>('/v1/watch-signals', {
    symbols: symbols.join(','),
    limit: params.limit ?? symbols.length,
    date: params.date,
    from: params.from,
  });
  return Array.isArray(json.data) ? json.data : [];
}
