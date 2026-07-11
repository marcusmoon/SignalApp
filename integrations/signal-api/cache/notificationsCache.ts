import type { SignalNotificationItem } from '@/integrations/signal-api/notifications';

export const SIGNAL_NOTIFICATIONS_CACHE_TTL_MS = 2 * 60 * 1000;

type Entry = { value: SignalNotificationItem[]; expiresAt: number };

const cache = new Map<string, Entry>();

export function buildSignalNotificationsCacheKey(params: {
  token: string;
  filter?: string;
  limit?: number;
}): string {
  const token = String(params.token || '');
  const filter = String(params.filter || 'all').trim().toLowerCase() || 'all';
  const limit = Number(params.limit) || 50;
  return `${token.length}:${token.slice(-16)}:${filter}:${limit}`;
}

export function peekSignalNotificationsCache(key: string): SignalNotificationItem[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.value;
  return null;
}

export function storeSignalNotificationsCache(
  key: string,
  value: SignalNotificationItem[],
  ttlMs = SIGNAL_NOTIFICATIONS_CACHE_TTL_MS,
): void {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function clearSignalNotificationsCache(): void {
  cache.clear();
}
