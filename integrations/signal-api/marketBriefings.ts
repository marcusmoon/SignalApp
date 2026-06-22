import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';

type MarketBriefingPage = {
  data: SignalApiMarketBriefing[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
};

export async function fetchSignalMarketBriefings(params: {
  market?: 'kr' | 'us';
  session?: 'morning' | 'lunch' | 'evening' | 'overnight' | 'close';
  date?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SignalApiMarketBriefing[]> {
  const json = await signalApi<MarketBriefingPage>(
    '/v1/market-briefings',
    {
      market: params.market,
      session: params.session,
      date: params.date,
      from: params.from,
      to: params.to,
      limit: params.limit ?? 10,
      offset: params.offset ?? 0,
    },
    { timeoutMs: 5000, attempts: 1 },
  );
  return Array.isArray(json.data) ? json.data : [];
}
