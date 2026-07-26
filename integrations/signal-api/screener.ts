import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiScreenerRun } from '@/integrations/signal-api/types';
import {
  buildSignalScreenerCacheKey,
  peekSignalScreenerCache,
  storeSignalScreenerCache,
} from '@/integrations/signal-api/cache/screenerCache';

export async function fetchSignalScreenerRun(
  params: { market?: string; method?: string; date?: string } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiScreenerRun | null> {
  const market = String(params.market || 'kr').trim() || 'kr';
  const method = String(params.method || 'momentum').trim() || 'momentum';
  const date = String(params.date || '').trim();
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalScreenerCacheKey({ market, method, date });
  if (cacheMode !== 'bypass') {
    const hit = peekSignalScreenerCache(cacheKey);
    if (hit) return hit.run;
  }
  const json = await signalApi<{ data: SignalApiScreenerRun | null }>(
    '/v1/screener',
    { market, method, date: date || undefined },
    { timeoutMs: 5000, attempts: 1 },
  );
  const run = json.data && typeof json.data === 'object' ? json.data : null;
  if (cacheMode !== 'bypass') storeSignalScreenerCache(cacheKey, run);
  return run;
}
