import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiConcall } from '@/integrations/signal-api/types';
import { buildSignalConcallsCacheKey, peekSignalConcallsCache, storeSignalConcallsCache } from '@/integrations/signal-api/cache/concallsCache';

export async function fetchSignalConcalls(
  params?: {
    symbol?: string;
    fiscalYear?: number;
    fiscalQuarter?: number;
    from?: string;
    to?: string;
    includeTranscript?: boolean;
    limit?: number;
    offset?: number;
    /** @deprecated */
    page?: number;
    pageSize?: number;
  },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiConcall[]> {
  const cacheMode = options?.cacheMode || 'use';
  const limit = params?.limit ?? params?.pageSize ?? 30;
  const offset =
    params?.offset ??
    (params?.page != null ? (Math.max(1, Number(params.page) || 1) - 1) * Number(limit) : 0);
  const cacheParams = { ...params, limit, offset };
  const cacheKey = buildSignalConcallsCacheKey(cacheParams);
  if (cacheMode !== 'bypass') {
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
    limit,
    offset,
  });
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalConcallsCache(cacheKey, rows);
  return rows;
}
