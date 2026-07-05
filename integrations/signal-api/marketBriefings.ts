import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import {
  buildSignalMarketBriefingsCacheKey,
  peekSignalMarketBriefingsCache,
  storeSignalMarketBriefingsCache,
} from '@/integrations/signal-api/cache/marketBriefingsCache';

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

export async function fetchSignalMarketBriefings(
  params: {
    market?: 'kr' | 'us';
    session?: 'morning' | 'lunch' | 'evening' | 'overnight' | 'close';
    date?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiMarketBriefing[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalMarketBriefingsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalMarketBriefingsCache(cacheKey);
    if (hit) return hit;
  }
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
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalMarketBriefingsCache(cacheKey, rows);
  return rows;
}
