import type { SignalApiConcall } from '@/integrations/signal-api/types';
import { peekCache, storeCache } from '@/integrations/signal-api/cache/common';

/** Concalls — memory cache TTL */
export const CONCALL_CACHE_TTL_MS = 15 * 60 * 1000;

const concallsCache = new Map<string, { value: SignalApiConcall[]; expiresAt: number }>();

export function buildSignalConcallsCacheKey(params?: {
  symbol?: string;
  fiscalYear?: number;
  fiscalQuarter?: number;
  from?: string;
  to?: string;
  includeTranscript?: boolean;
  page?: number;
  pageSize?: number;
}): string {
  const p = {
    symbol: String(params?.symbol || '').trim().toUpperCase(),
    fiscalYear: Number(params?.fiscalYear) || 0,
    fiscalQuarter: Number(params?.fiscalQuarter) || 0,
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    includeTranscript: params?.includeTranscript === true ? 1 : 0,
    page: Number(params?.page) || 0,
    pageSize: Number(params?.pageSize) || 0,
  };
  return `concalls|${p.symbol}|${p.fiscalYear}|${p.fiscalQuarter}|${p.from}|${p.to}|${p.includeTranscript}|${p.page}|${p.pageSize}`;
}

export function peekSignalConcallsCache(key: string): SignalApiConcall[] | null {
  return peekCache(concallsCache, key);
}

export function storeSignalConcallsCache(key: string, value: SignalApiConcall[]): void {
  storeCache(concallsCache, key, value, CONCALL_CACHE_TTL_MS);
}

export function clearSignalConcallsCache(): void {
  concallsCache.clear();
}

