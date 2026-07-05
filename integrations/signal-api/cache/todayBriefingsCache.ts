import type { SignalApiTodayBriefing } from '@/integrations/signal-api/types';
import { peekCache, SIGNAL_FEED_CACHE_TTL_MS, storeCache } from '@/integrations/signal-api/cache/common';

const briefingsCache = new Map<string, { value: SignalApiTodayBriefing | null; expiresAt: number }>();

export function buildSignalTodayBriefingCacheKey(params?: {
  date?: string;
  locale?: string;
  from?: string;
  to?: string;
}): string {
  const p = {
    date: String(params?.date || '').trim(),
    locale: String(params?.locale || 'ko').trim(),
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
  };
  return `today-briefing|${p.date}|${p.locale}|${p.from}|${p.to}`;
}

export function peekSignalTodayBriefingCache(key: string): SignalApiTodayBriefing | null | undefined {
  const e = briefingsCache.get(key);
  if (e && Date.now() < e.expiresAt) return e.value;
  return undefined;
}

export function storeSignalTodayBriefingCache(key: string, value: SignalApiTodayBriefing | null): void {
  storeCache(briefingsCache, key, value, SIGNAL_FEED_CACHE_TTL_MS);
}

export function clearSignalTodayBriefingsCache(): void {
  briefingsCache.clear();
}
