import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiMarketList } from '@/integrations/signal-api/types';
import {
  buildSignalMarketListCacheKey,
  peekSignalMarketListCache,
  storeSignalMarketListCache,
} from '@/integrations/signal-api/cache/marketCache';

export async function fetchSignalMarketList(
  key: string,
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiMarketList> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalMarketListCacheKey(key);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalMarketListCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiMarketList }>(`/v1/market-lists/${encodeURIComponent(key)}`);
  const value = json.data;
  if (cacheMode !== 'bypass') storeSignalMarketListCache(cacheKey, value);
  return value;
}
