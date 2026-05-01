import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiConcall } from '@/integrations/signal-api/types';
import { buildSignalConcallsCacheKey, peekSignalConcallsCache, storeSignalConcallsCache } from '@/integrations/signal-api/cache/concallsCache';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';

export async function fetchSignalConcalls(
  params?: {
  symbol?: string;
  fiscalYear?: number;
  fiscalQuarter?: number;
  from?: string;
  to?: string;
  includeTranscript?: boolean;
  page?: number;
  pageSize?: number;
},
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiConcall[]> {
  const cacheMode = options?.cacheMode || 'use';
  const { concallEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalConcallsCacheKey(params);
  if (cacheMode !== 'bypass' && concallEnabled) {
    const hit = peekSignalConcallsCache(cacheKey);
    if (hit) return hit;
  }
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
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass' && concallEnabled) storeSignalConcallsCache(cacheKey, rows);
  return rows;
}
