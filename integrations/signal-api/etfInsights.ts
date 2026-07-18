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

/**
 * 홈용: 선택 날짜의 인사이트.
 * 1) insightDate 정확 일치
 * 2) 없으면 최신 N건 중 insightDate ≤ 선택일 (장중/전일 마감 인사이트 노출)
 */
export async function fetchSignalEtfInsightForDate(
  date: string,
  options?: { cacheMode?: SignalCacheMode; period?: string },
): Promise<SignalApiEtfInsight | null> {
  const exact = await fetchSignalEtfInsights(
    {
      date,
      period: options?.period,
      limit: 1,
      offset: 0,
    },
    options,
  );
  if (exact[0]) return exact[0];

  const recent = await fetchSignalEtfInsights(
    {
      period: options?.period,
      limit: 10,
      offset: 0,
    },
    options,
  );
  const onOrBefore = recent.find((row) => {
    const insightDate = String(row.insightDate || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(insightDate) && insightDate <= date;
  });
  return onOrBefore ?? null;
}
