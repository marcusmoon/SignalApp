import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  fetchSignalNotifications,
  fetchSignalNotificationsUnreadCount,
  markSignalNotificationsRead,
  type AlertsFilter,
  type SignalNotificationItem,
  SIGNAL_NOTIFICATION_MAX,
} from '@/integrations/signal-api/notifications';
import type { SignalCacheMode } from '@/integrations/signal-api/cacheMode';
import { hasSignalApi } from '@/services/env';
import { getSessionAccessToken, loadAppAuthSession } from '@/services/appAuthSession';
import type { StoredNotification } from '@/services/notificationHistory';

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

export function mapNotificationToStored(item: SignalNotificationItem): StoredNotification {
  return {
    id: item.id,
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

async function loadVisibleAlerts(
  access: string,
  filter: AlertsFilter = 'all',
  cacheMode: SignalCacheMode = 'use',
): Promise<StoredNotification[]> {
  const rows = await fetchSignalNotifications(access, {
    limit: SIGNAL_NOTIFICATION_MAX,
    filter,
    cacheMode,
  });
  return rows.map(mapNotificationToStored);
}

export async function checkAlertsHasUnread(): Promise<boolean> {
  const savedSession = await loadAppAuthSession();
  const access = getSessionAccessToken(savedSession);
  if (!access || !hasSignalApi()) return false;
  try {
    const count = await fetchSignalNotificationsUnreadCount(access);
    return count > 0;
  } catch {
    const cached = await loadAlertsUnreadCached();
    return cached ?? false;
  }
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

/** 알림함 진입 시 호출 — 서버 read + 로컬 배지 갱신 */
export async function markAlertsSeen(): Promise<void> {
  const savedSession = await loadAppAuthSession();
  const access = getSessionAccessToken(savedSession);
  if (access && hasSignalApi()) {
    try {
      await markSignalNotificationsRead(access, { all: true });
    } catch {
      /* badge cache still cleared below */
    }
  }
  await setAlertsUnreadCached(false);
}

export async function loadAlertsFromServer(
  access: string,
  filter: AlertsFilter = 'all',
  options?: { cacheMode?: SignalCacheMode },
): Promise<StoredNotification[]> {
  if (!hasSignalApi()) return [];
  try {
    return await loadVisibleAlerts(access, filter, options?.cacheMode ?? 'use');
  } catch {
    return [];
  }
}

export function isServerNotificationId(id: string): boolean {
  return /^[^:]+:notification:/.test(String(id || '').trim());
}
