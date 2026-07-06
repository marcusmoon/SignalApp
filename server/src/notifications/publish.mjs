import { createNotificationItem } from './outbox.mjs';

/** 알림함 노출용 — 푸시 발송과 분리 */
export function buildPublishedNotification(input, { queuePush = false } = {}) {
  const item = createNotificationItem({ ...input, status: 'published' });
  if (!item) return null;
  const nested = item.payload && typeof item.payload === 'object' ? item.payload : {};
  item.payload = {
    ...nested,
    body: item.body,
    deepLink: item.deepLink,
    pushDelivery: queuePush ? 'pending' : 'none',
  };
  return item;
}
