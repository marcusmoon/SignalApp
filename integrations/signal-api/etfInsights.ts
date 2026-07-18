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

export async function fetchSignalEtfInsightsPage(
  params: {
    period?: string;
    date?: string;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<{ items: SignalApiEtfInsight[]; meta: EtfInsightPage['meta'] }> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalEtfInsightsCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalEtfInsightsCache(cacheKey);
    if (hit) {
      return {
        items: hit,
        meta: {
          limit: params.limit ?? 10,
          offset: params.offset ?? 0,
          total: hit.length,
          hasMore: false,
          nextOffset: null,
        },
      };
    }
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
  const meta = json.meta || {
    limit: params.limit ?? 10,
    offset: params.offset ?? 0,
    total: rows.length,
    hasMore: false,
    nextOffset: null,
  };
  if (cacheMode !== 'bypass') storeSignalEtfInsightsCache(cacheKey, rows);
  return { items: rows, meta };
}

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
  const page = await fetchSignalEtfInsightsPage(params, options);
  return page.items;
}

export async function fetchSignalEtfInsightById(
  id: string,
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiEtfInsight | null> {
  const cleanId = String(id || '').trim();
  if (!cleanId) return null;
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = `etf-insight|id|${cleanId}`;
  if (cacheMode !== 'bypass') {
    const hit = peekSignalEtfInsightsCache(cacheKey);
    if (hit?.[0]) return hit[0];
  }
  const json = await signalApi<{ data: SignalApiEtfInsight }>(
    `/v1/etf-insights/${encodeURIComponent(cleanId)}`,
    undefined,
    { timeoutMs: 5000, attempts: 1 },
  );
  const row = json?.data ?? null;
  if (row && cacheMode !== 'bypass') storeSignalEtfInsightsCache(cacheKey, [row]);
  return row;
}

/**
 * 홈용: 선택 날짜의 ETF 브리핑.
 * 1) insightDate 정확 일치
 * 2) 없으면 최신 N건 중 insightDate ≤ 선택일 (장중/전일 마감 브리핑 노출)
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
