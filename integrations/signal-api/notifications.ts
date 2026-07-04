import { signalApiRequest } from './httpClient';

export type SignalNotificationItem = {
  id: string;
  type: string;
  channel: string;
  status: string;
  priority: string;
  title: string;
  body: string;
  sourceType?: string;
  deepLink?: string;
  scheduledAt?: string | null;
  createdAt?: string | null;
};

type NotificationsResponse = {
  data?: SignalNotificationItem[];
};

export async function fetchSignalNotifications(token: string, limit = 50): Promise<SignalNotificationItem[]> {
  const body = await signalApiRequest<NotificationsResponse>('/v1/notifications', {
    token,
    params: { limit },
  });
  return Array.isArray(body.data) ? body.data : [];
}

export async function requestSignalPushTest(token: string): Promise<SignalNotificationItem> {
  const body = await signalApiRequest<{ data: SignalNotificationItem }>('/v1/notifications/test', {
    method: 'POST',
    token,
  });
  return body.data;
}
