import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiKrScreenerRun } from '@/integrations/signal-api/types';
import {
  buildSignalKrScreenerCacheKey,
  peekSignalKrScreenerCache,
  storeSignalKrScreenerCache,
} from '@/integrations/signal-api/cache/krScreenerCache';

export async function fetchSignalKrScreenerRun(
  params: { preset?: string; date?: string } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiKrScreenerRun | null> {
  const preset = String(params.preset || 'fujimoto').trim() || 'fujimoto';
  const date = String(params.date || '').trim();
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalKrScreenerCacheKey({ preset, date });
  if (cacheMode !== 'bypass') {
    const hit = peekSignalKrScreenerCache(cacheKey);
    if (hit) return hit.run;
  }
  const json = await signalApi<{ data: SignalApiKrScreenerRun | null }>(
    '/v1/screener/kr',
    { preset, date: date || undefined },
    { timeoutMs: 5000, attempts: 1 },
  );
  const run = json.data && typeof json.data === 'object' ? json.data : null;
  if (cacheMode !== 'bypass') storeSignalKrScreenerCache(cacheKey, run);
  return run;
}
