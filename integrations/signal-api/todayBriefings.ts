import { signalApi } from '@/integrations/signal-api/httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';
import {
  buildSignalTodayBriefingCacheKey,
  peekSignalTodayBriefingCache,
  storeSignalTodayBriefingCache,
} from '@/integrations/signal-api/cache/todayBriefingsCache';

export async function fetchSignalTodayBriefing(
  params: {
    date?: string;
    locale?: string;
    from?: string;
    to?: string;
  } = {},
  options?: { cacheMode?: SignalCacheMode },
): Promise<SignalApiTodayBriefing | null> {
  const cacheMode = options?.cacheMode || 'use';
  const cacheKey = buildSignalTodayBriefingCacheKey(params);
  if (cacheMode !== 'bypass') {
    const hit = peekSignalTodayBriefingCache(cacheKey);
    if (hit !== undefined) return hit;
  }
  const json = await signalApi<{ data: SignalApiTodayBriefing | null }>(
    '/v1/today-briefing',
    {
      date: params.date,
      locale: params.locale ?? 'ko',
      from: params.from,
      to: params.to,
    },
    { timeoutMs: 4000, attempts: 1 },
  );
  const value = json.data ?? null;
  if (cacheMode !== 'bypass') storeSignalTodayBriefingCache(cacheKey, value);
  return value;
}
