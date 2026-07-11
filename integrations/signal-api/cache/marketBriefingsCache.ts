import type { SignalApiMarketBriefing } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

const briefingsCache = new Map<string, { value: SignalApiMarketBriefing[]; expiresAt: number }>();

export function buildSignalMarketBriefingsCacheKey(params?: {
  market?: string;
  session?: string;
  date?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  locale?: string;
}): string {
  const p = {
    market: String(params?.market || '').trim(),
    session: String(params?.session || '').trim(),
    date: String(params?.date || '').trim(),
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    limit: Number(params?.limit) || 0,
    offset: Number(params?.offset) || 0,
    locale: String(params?.locale || '').trim() || 'ko',
  };
  return `market-briefings|${p.market}|${p.session}|${p.date}|${p.from}|${p.to}|${p.limit}|${p.offset}|${p.locale}`;
}

export function peekSignalMarketBriefingsCache(key: string): SignalApiMarketBriefing[] | null {
  return peekCache(briefingsCache, key);
}

export function storeSignalMarketBriefingsCache(key: string, value: SignalApiMarketBriefing[]): void {
  storeCache(briefingsCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalMarketBriefingsCache(): void {
  briefingsCache.clear();
}
