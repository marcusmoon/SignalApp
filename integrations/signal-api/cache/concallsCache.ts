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
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
}): string {
  const limit = Number(params?.limit ?? params?.pageSize) || 30;
  const offset =
    params?.offset != null && String(params.offset).trim() !== ''
      ? Number(params.offset) || 0
      : Math.max(0, (Math.max(1, Number(params?.page) || 1) - 1) * limit);
  const p = {
    symbol: String(params?.symbol || '').trim().toUpperCase(),
    fiscalYear: Number(params?.fiscalYear) || 0,
    fiscalQuarter: Number(params?.fiscalQuarter) || 0,
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    includeTranscript: params?.includeTranscript === true ? 1 : 0,
    limit,
    offset,
  };
  return `concalls|${p.symbol}|${p.fiscalYear}|${p.fiscalQuarter}|${p.from}|${p.to}|${p.includeTranscript}|${p.limit}|${p.offset}`;
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

