import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchSignalNotificationInboxUnreadCount,
  fetchSignalNotifications,
  markSignalNotificationInboxRead,
  SIGNAL_NOTIFICATION_INBOX_MAX,
} from '@/integrations/signal-api/notifications';
import { hasSignalApi } from '@/services/env';
import { getSessionAccessToken, loadAppAuthSession } from '@/services/appAuthSession';
import {
  loadDismissedNotificationIds,
  loadNotificationHistory,
  type StoredNotification,
} from '@/services/notificationHistory';

const LAST_SEEN_AT_KEY = '@signal/alerts_last_seen_at_v1';
const UNREAD_CACHE_KEY = '@signal/alerts_has_unread_v1';
const REFRESH_DEDUPE_MS = 30 * 1000;

let refreshInFlight: Promise<boolean> | null = null;
let lastRefreshAt = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore */
    }
  });
}

export function subscribeAlertsUnreadChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadLastSeenAlertsAt(): Promise<string | null> {
  const v = await AsyncStorage.getItem(LAST_SEEN_AT_KEY);
  return v && v.trim() ? v.trim() : null;
}

export async function loadAlertsUnreadCached(): Promise<boolean | null> {
  const v = await AsyncStorage.getItem(UNREAD_CACHE_KEY);
  if (v === '1') return true;
  if (v === '0') return false;
  return null;
}

export async function setAlertsUnreadCached(hasUnread: boolean): Promise<void> {
  await AsyncStorage.setItem(UNREAD_CACHE_KEY, hasUnread ? '1' : '0');
  notify();
}

async function saveLastSeenAlertsAt(iso: string): Promise<void> {
  if (!iso.trim()) return;
  await AsyncStorage.setItem(LAST_SEEN_AT_KEY, iso.trim());
}

function mapServerNotification(item: Awaited<ReturnType<typeof fetchSignalNotifications>>[number]): StoredNotification {
  return {
    id: item.inboxId || `server:${item.id}`,
    title: item.title,
    body: item.body,
    receivedAt: item.deliveredAt || item.scheduledAt || item.createdAt || new Date().toISOString(),
    high: item.priority === 'high',
    type: item.type,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    deepLink: item.deepLink,
    payload: item.payload,
  };
}

async function loadVisibleAlerts(): Promise<StoredNotification[]> {
  const savedSession = await loadAppAuthSession();
  const access = getSessionAccessToken(savedSession);
  const [list, serverNotifications, dismissed] = await Promise.all([
    loadNotificationHistory(),
    access && hasSignalApi()
      ? fetchSignalNotifications(access, SIGNAL_NOTIFICATION_INBOX_MAX).catch(() => [])
      : Promise.resolve([]),
    loadDismissedNotificationIds(),
  ]);
  const serverItems = serverNotifications.map(mapServerNotification);
  const seen = new Set<string>();
  return [...serverItems, ...list]
    .filter((item) => {
      if (dismissed.has(item.id)) return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime())
    .slice(0, SIGNAL_NOTIFICATION_INBOX_MAX);
}

export async function checkAlertsHasUnread(): Promise<boolean> {
  const savedSession = await loadAppAuthSession();
  const access = getSessionAccessToken(savedSession);
  if (access && hasSignalApi()) {
    try {
      const count = await fetchSignalNotificationInboxUnreadCount(access);
      return count > 0;
    } catch {
      /* fall through to local merge */
    }
  }
  const items = await loadVisibleAlerts();
  if (items.length === 0) return false;
  const lastSeenAt = await loadLastSeenAlertsAt();
  if (!lastSeenAt) return true;
  const newestMs = new Date(items[0].receivedAt).getTime();
  const seenMs = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(newestMs) || !Number.isFinite(seenMs)) return true;
  return newestMs > seenMs;
}

export async function refreshAlertsUnreadFromServer(options?: { force?: boolean }): Promise<boolean> {
  const now = Date.now();
  if (!options?.force && refreshInFlight) return refreshInFlight;

  if (!options?.force && now - lastRefreshAt < REFRESH_DEDUPE_MS) {
    const cached = await loadAlertsUnreadCached();
    if (cached !== null) return cached;
  }

  refreshInFlight = (async () => {
    try {
      const hasUnread = await checkAlertsHasUnread();
      await setAlertsUnreadCached(hasUnread);
      return hasUnread;
    } finally {
      lastRefreshAt = Date.now();
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

/** 알림함 진입 시 호출 — 서버 인박스 read + 로컬 배지 갱신 */
export async function markAlertsSeen(): Promise<void> {
  const savedSession = await loadAppAuthSession();
  const access = getSessionAccessToken(savedSession);
  if (access && hasSignalApi()) {
    try {
      await markSignalNotificationInboxRead(access, { all: true });
    } catch {
      /* keep local fallback below */
    }
  }
  const items = await loadVisibleAlerts();
  const newestAt = items[0]?.receivedAt || new Date().toISOString();
  await saveLastSeenAlertsAt(newestAt);
  await setAlertsUnreadCached(false);
}

export function isServerInboxNotificationId(id: string): boolean {
  return /^[^:]+:notification:/.test(String(id || '').trim());
}
