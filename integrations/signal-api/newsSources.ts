import { signalApi } from '@/integrations/signal-api/client';
import type { SignalApiNewsSource } from '@/integrations/signal-api/types';
import { loadCacheFeaturePrefs } from '@/services/cacheFeaturePreferences';
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
  const { newsEnabled } = await loadCacheFeaturePrefs();
  const cacheKey = buildSignalNewsSourcesCacheKey(params);
  if (cacheMode !== 'bypass' && newsEnabled) {
    const hit = peekSignalNewsSourcesCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<{ data: SignalApiNewsSource[] }>('/v1/news-sources', params);
  const rows = Array.isArray(json.data) ? json.data : [];
  if (newsEnabled) storeSignalNewsSourcesCache(cacheKey, rows);
  return rows;
}
