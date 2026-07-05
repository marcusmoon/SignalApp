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
  sourceId?: string;
  deepLink?: string;
  payload?: Record<string, unknown>;
  scheduledAt?: string | null;
  createdAt?: string | null;
  inboxId?: string | null;
  readAt?: string | null;
  deliveredAt?: string | null;
};

export type SignalNotificationInboxItem = SignalNotificationItem & {
  notificationId: string;
};

type InboxResponse = {
  data?: SignalNotificationInboxItem[];
  maxItems?: number;
};

export const SIGNAL_NOTIFICATION_INBOX_MAX = 50;

export async function fetchSignalNotificationInbox(
  token: string,
  limit = SIGNAL_NOTIFICATION_INBOX_MAX,
): Promise<SignalNotificationInboxItem[]> {
  const body = await signalApiRequest<InboxResponse>('/v1/notifications/inbox', {
    token,
    params: { limit },
  });
  return Array.isArray(body.data) ? body.data : [];
}

export async function fetchSignalNotificationInboxUnreadCount(token: string): Promise<number> {
  const body = await signalApiRequest<{ data?: { count?: number } }>('/v1/notifications/inbox/unread-count', {
    token,
  });
  return Number(body.data?.count) || 0;
}

export async function markSignalNotificationInboxRead(
  token: string,
  options: { ids?: string[]; all?: boolean },
): Promise<number> {
  const body = await signalApiRequest<{ data?: { updated?: number } }>('/v1/notifications/inbox/read', {
    method: 'PATCH',
    token,
    body: options,
  });
  return Number(body.data?.updated) || 0;
}

export async function deleteSignalNotificationInboxItems(
  token: string,
  options: { ids?: string[]; all?: boolean },
): Promise<number> {
  const body = await signalApiRequest<{ data?: { deleted?: number } }>('/v1/notifications/inbox', {
    method: 'DELETE',
    token,
    body: options,
  });
  return Number(body.data?.deleted) || 0;
}

export async function deliverSignalNotificationInbox(token: string, notificationId: string): Promise<void> {
  await signalApiRequest('/v1/notifications/inbox/deliver', {
    method: 'POST',
    token,
    body: { notificationId },
  });
}

export async function requestSignalPushTest(token: string): Promise<SignalNotificationItem> {
  const body = await signalApiRequest<{ data: SignalNotificationItem }>('/v1/notifications/test', {
    method: 'POST',
    token,
  });
  return body.data;
}
