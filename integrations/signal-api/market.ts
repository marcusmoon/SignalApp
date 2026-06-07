import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiCoinMarket, SignalApiMarketQuote } from '@/integrations/signal-api/types';

export async function fetchSignalMarketQuotes(params: {
  segment?: string;
  symbols?: readonly string[];
  limit?: number;
  offset?: number;
  refresh?: boolean;
} = {}): Promise<SignalApiMarketQuote[]> {
  const json = await signalApi<{ data: SignalApiMarketQuote[] }>(
    '/v1/market-quotes',
    {
      segment: params.segment,
      symbols: params.symbols?.join(','),
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
      refresh: params.refresh ? '1' : undefined,
    },
    { timeoutMs: params.refresh ? 8000 : 5000, attempts: 1 },
  );
  return json.data;
}

export async function fetchSignalCoins(params: { limit?: number; offset?: number } = {}): Promise<SignalApiCoinMarket[]> {
  const json = await signalApi<{ data: SignalApiCoinMarket[] }>(
    '/v1/coins',
    {
      limit: params.limit ?? 100,
      offset: params.offset ?? 0,
    },
    { timeoutMs: 5000, attempts: 1 },
  );
  return json.data;
}
