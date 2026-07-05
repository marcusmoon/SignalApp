import { signalApiRequest } from './httpClient';

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
  limit = SIGNAL_NOTIFICATION_MAX,
): Promise<SignalNotificationItem[]> {
  const body = await signalApiRequest<NotificationsResponse>('/v1/notifications', {
    token,
    params: { limit },
  });
  return Array.isArray(body.data) ? body.data : [];
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
