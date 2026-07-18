import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

const etfInsightsCache = new Map<string, { value: SignalApiEtfInsight[]; expiresAt: number }>();

export function buildSignalEtfInsightsCacheKey(params?: {
  period?: string;
  date?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): string {
  const p = {
    period: String(params?.period || '').trim(),
    date: String(params?.date || '').trim(),
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    limit: Number(params?.limit ?? 10) || 10,
    offset: Number(params?.offset ?? 0) || 0,
  };
  return `etf-insights|${p.period}|${p.date}|${p.from}|${p.to}|${p.limit}|${p.offset}`;
}

export function peekSignalEtfInsightsCache(key: string): SignalApiEtfInsight[] | null {
  return peekCache(etfInsightsCache, key);
}

export function storeSignalEtfInsightsCache(key: string, value: SignalApiEtfInsight[]): void {
  storeCache(etfInsightsCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalEtfInsightsCache(): void {
  etfInsightsCache.clear();
}
