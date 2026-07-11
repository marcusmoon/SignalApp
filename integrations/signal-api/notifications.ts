import { signalApiRequest } from './httpClient';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import {
  buildSignalNotificationsCacheKey,
  peekSignalNotificationsCache,
  storeSignalNotificationsCache,
} from '@/integrations/signal-api/cache/notificationsCache';

export type AlertsFilter = 'all' | 'high' | 'signal' | 'system';

export type SignalNotificationItem = {
  id: string;
  notificationId: string;
  type: string;
  channel: string;
  status: string;
  priority: string;
  title: string;
  body: string;
  sourceType?: string;
  sourceId?: string;
  deepLink?: string;
  payload?: Record<string, unknown>;
  scheduledAt?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
};

type NotificationsResponse = {
  data?: SignalNotificationItem[];
  maxItems?: number;
};

export const SIGNAL_NOTIFICATION_MAX = 50;

export async function fetchSignalNotifications(
  token: string,
  options: {
    limit?: number;
    filter?: AlertsFilter;
    cacheMode?: SignalCacheMode;
  } = {},
): Promise<SignalNotificationItem[]> {
  const limit = options.limit ?? SIGNAL_NOTIFICATION_MAX;
  const filter = options.filter ?? 'all';
  const cacheMode = options.cacheMode ?? 'use';
  const cacheKey = buildSignalNotificationsCacheKey({ token, filter, limit });
  if (cacheMode !== 'bypass') {
    const cached = peekSignalNotificationsCache(cacheKey);
    if (cached) return cached;
  }
  const body = await signalApiRequest<NotificationsResponse>('/v1/notifications', {
    token,
    params: { limit, filter },
  });
  const rows = Array.isArray(body.data) ? body.data : [];
  if (cacheMode !== 'bypass') storeSignalNotificationsCache(cacheKey, rows);
  return rows;
}

export async function fetchSignalNotificationsUnreadCount(token: string): Promise<number> {
  const body = await signalApiRequest<{ data?: { count?: number } }>('/v1/notifications/unread-count', {
    token,
  });
  return Number(body.data?.count) || 0;
}

export async function markSignalNotificationsRead(
  token: string,
  options: { ids?: string[]; all?: boolean },
): Promise<number> {
  const body = await signalApiRequest<{ data?: { updated?: number } }>('/v1/notifications/read', {
    method: 'PATCH',
    token,
    body: options,
  });
  return Number(body.data?.updated) || 0;
}

export async function deleteSignalNotifications(
  token: string,
  options: { ids?: string[]; all?: boolean },
): Promise<number> {
  const body = await signalApiRequest<{ data?: { deleted?: number } }>('/v1/notifications', {
    method: 'DELETE',
    token,
    body: options,
  });
  return Number(body.data?.deleted) || 0;
}

export async function deliverSignalNotification(token: string, notificationId: string): Promise<void> {
  await signalApiRequest('/v1/notifications/deliver', {
    method: 'POST',
    token,
    body: { notificationId },
  });
}

export async function requestSignalPushTest(token: string): Promise<Omit<SignalNotificationItem, 'notificationId' | 'readAt' | 'deliveredAt'>> {
  const body = await signalApiRequest<{ data: Omit<SignalNotificationItem, 'notificationId' | 'readAt' | 'deliveredAt'> }>(
    '/v1/notifications/test',
    {
      method: 'POST',
      token,
    },
  );
  return body.data;
}

export type SignalNotificationPrefs = {
  pushEnabled: boolean;
  briefingPushEnabled: boolean;
};

export async function fetchSignalNotificationPrefs(token: string): Promise<SignalNotificationPrefs> {
  const body = await signalApiRequest<{ data?: SignalNotificationPrefs }>('/v1/notifications/prefs', { token });
  return {
    pushEnabled: body.data?.pushEnabled !== false,
    briefingPushEnabled: body.data?.briefingPushEnabled !== false,
  };
}

export async function updateSignalNotificationPrefs(
  token: string,
  prefs: Partial<SignalNotificationPrefs>,
): Promise<SignalNotificationPrefs> {
  const body = await signalApiRequest<{ data?: SignalNotificationPrefs }>('/v1/notifications/prefs', {
    method: 'PATCH',
    token,
    body: prefs,
  });
  return {
    pushEnabled: body.data?.pushEnabled !== false,
    briefingPushEnabled: body.data?.briefingPushEnabled !== false,
  };
}
