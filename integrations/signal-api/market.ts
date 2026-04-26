import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiCoinMarket, SignalApiMarketQuote } from '@/integrations/signal-api/types';

export async function fetchSignalMarketQuotes(params: {
  segment?: string;
  symbols?: readonly string[];
  pageSize?: number;
} = {}): Promise<SignalApiMarketQuote[]> {
  const json = await signalApi<{ data: SignalApiMarketQuote[] }>('/v1/market-quotes', {
    segment: params.segment,
    symbols: params.symbols?.join(','),
    pageSize: params.pageSize ?? 100,
  });
  return json.data;
}

export async function fetchSignalCoins(params: { pageSize?: number } = {}): Promise<SignalApiCoinMarket[]> {
  const json = await signalApi<{ data: SignalApiCoinMarket[] }>('/v1/coins', {
    pageSize: params.pageSize ?? 100,
  });
  return json.data;
}
