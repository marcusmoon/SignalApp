import type { SignalApiKrScreenerRun } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

type Box = { run: SignalApiKrScreenerRun | null };

const krScreenerCache = new Map<string, { value: Box; expiresAt: number }>();

export function buildSignalKrScreenerCacheKey(params?: { preset?: string; date?: string }): string {
  return `kr-screener|${String(params?.preset || 'fujimoto').trim()}|${String(params?.date || '').trim()}`;
}

export function peekSignalKrScreenerCache(key: string): Box | null {
  return peekCache(krScreenerCache, key);
}

export function storeSignalKrScreenerCache(key: string, run: SignalApiKrScreenerRun | null): void {
  storeCache(krScreenerCache, key, { run }, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalKrScreenerCache(): void {
  krScreenerCache.clear();
}
