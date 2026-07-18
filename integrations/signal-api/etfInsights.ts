import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiEtfInsight } from '@/integrations/signal-api/types';
import {
  buildSignalEtfInsightsCacheKey,
  peekSignalEtfInsightsCache,
  storeSignalEtfInsightsCache,
} from '@/integrations/signal-api/cache/etfInsightsCache';

type EtfInsightPage = {
  data: SignalApiEtfInsight[];
  meta: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
};

export async function fetchSignalEtfInsights(
  params: {
    period?: string;
    date?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiEtfInsight[]> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalEtfInsightsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalEtfInsightsCache(cacheKey);
    if (hit) return hit;
  }
  const json = await signalApi<EtfInsightPage>(
    '/v1/etf-insights',
    {
      period: params.period,
      date: params.date,
      from: params.from,
      to: params.to,
      limit: params.limit ?? 10,
      offset: params.offset ?? 0,
    },
    { timeoutMs: 5000, attempts: 1 },
  );
  const rows = Array.isArray(json.data) ? json.data : [];
  if (cacheMode !== 'bypass') storeSignalEtfInsightsCache(cacheKey, rows);
  return rows;
}

/** 홈용: 선택 날짜의 최신 인사이트 1건 (`period` 지정 시 해당 period만) */
export async function fetchSignalEtfInsightForDate(
  date: string,
  options?: { cacheMode?: SignalCacheMode; period?: string },
): Promise<SignalApiEtfInsight | null> {
  const rows = await fetchSignalEtfInsights(
    {
      date,
      period: options?.period,
      limit: 1,
      offset: 0,
    },
    options,
  );
  return rows[0] ?? null;
}
