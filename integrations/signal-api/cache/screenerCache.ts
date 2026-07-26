import type { SignalApiScreenerRun } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

type Box = { run: SignalApiScreenerRun | null };

const screenerCache = new Map<string, { value: Box; expiresAt: number }>();

export function buildSignalScreenerCacheKey(params?: {
  market?: string;
  method?: string;
  date?: string;
}): string {
  return [
    'screener',
    String(params?.market || 'kr').trim() || 'kr',
    String(params?.method || 'fujimoto').trim() || 'fujimoto',
    String(params?.date || '').trim(),
  ].join('|');
}

export function peekSignalScreenerCache(key: string): Box | null {
  return peekCache(screenerCache, key);
}

export function storeSignalScreenerCache(key: string, run: SignalApiScreenerRun | null): void {
  storeCache(screenerCache, key, { run }, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalScreenerCache(): void {
  screenerCache.clear();
}
