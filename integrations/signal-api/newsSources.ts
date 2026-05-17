import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalApiNewsSource } from '@/integrations/signal-api/types';
import {
  buildSignalNewsSourcesCacheKey,
  peekSignalNewsSourcesCache,
  storeSignalNewsSourcesCache,
} from '@/integrations/signal-api/cache/newsCache';

export async function fetchSignalNewsSources(
  params?: { category?: string },
  options?: { cacheMode?: 'use' | 'bypass' },
): Promise<SignalApiNewsSource[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalNewsSourcesCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalNewsSourcesCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiNewsSource[] }>('/v1/news-sources', params);
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalNewsSourcesCache(cacheKey, rows);
  return rows;
}
