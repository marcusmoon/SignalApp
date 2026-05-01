import type { SignalApiCalendarEvent } from '@/integrations/signal-api/types';
import { CALENDAR_CACHE_TTL_MS } from '@/services/cache/calendarCache';
import { peekCache, storeCache } from '@/integrations/signal-api/cache/common';

const calendarCache = new Map<string, { value: SignalApiCalendarEvent[]; expiresAt: number }>();

export function buildSignalCalendarCacheKey(params?: { from?: string; to?: string; type?: string }): string {
  const p = {
    from: String(params?.from || '').trim(),
    to: String(params?.to || '').trim(),
    type: String(params?.type || '').trim().toLowerCase(),
  };
  return `calendar|${p.from}|${p.to}|${p.type}`;
}

export function peekSignalCalendarCache(key: string): SignalApiCalendarEvent[] | null {
  return peekCache(calendarCache, key);
}

export function storeSignalCalendarCache(key: string, value: SignalApiCalendarEvent[]): void {
  storeCache(calendarCache, key, value, CALENDAR_CACHE_TTL_MS);
}

export function clearSignalCalendarCache(): void {
  calendarCache.clear();
}

