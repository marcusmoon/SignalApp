import { signalApiRequest } from './httpClient';

export type SignalNotificationItem = {
  id: string;
  type: string;
  channel: string;
  status: string;
  priority: string;
  title: string;
  body: string;
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
