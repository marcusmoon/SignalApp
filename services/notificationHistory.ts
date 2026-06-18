import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@signal/notification_history_v1';
const DISMISSED_KEY = '@signal/dismissed_notification_ids_v1';
const MAX_ITEMS = 100;
const MAX_DISMISSED = 200;

export type StoredNotification = {
  id: string;
  title: string;
  body: string;
  receivedAt: string;
  high: boolean;
  type?: string;
  sourceType?: string;
};

export async function loadNotificationHistory(): Promise<StoredNotification[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredNotification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function save(list: StoredNotification[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
}

function isHighFromData(data?: Record<string, unknown>): boolean {
  if (!data) return false;
  if (data.high === true) return true;
  const p = data.priority;
  return p === 'high' || p === 'HIGH';
}

/** Dedupe: same title+body within 2s (foreground + tap). */
function shouldSkipDuplicate(prev: StoredNotification[], next: StoredNotification): boolean {
  const last = prev[0];
  if (!last) return false;
  if (last.title !== next.title || last.body !== next.body) return false;
  const dt = new Date(next.receivedAt).getTime() - new Date(last.receivedAt).getTime();
  return dt >= 0 && dt < 2000;
}

export async function appendNotificationFromPayload(input: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const title = input.title.trim() || '(SIGNAL)';
  const body = input.body.trim();
  const high = isHighFromData(input.data);
  const item: StoredNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title,
    body,
    receivedAt: new Date().toISOString(),
    high,
    type: String(input.data?.type || '').trim() || undefined,
    sourceType: String(input.data?.sourceType || '').trim() || undefined,
  };
  const prev = await loadNotificationHistory();
  if (shouldSkipDuplicate(prev, item)) return;
  await save([item, ...prev]);
}

export async function loadDismissedNotificationIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(DISMISSED_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

async function saveDismissedNotificationIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(ids.slice(0, MAX_DISMISSED)));
}

export async function removeNotificationById(id: string): Promise<void> {
  if (id.startsWith('server:')) {
    const dismissed = await loadDismissedNotificationIds();
    if (dismissed.has(id)) return;
    await saveDismissedNotificationIds([id, ...dismissed]);
    return;
  }
  const list = await loadNotificationHistory();
  const next = list.filter((item) => item.id !== id);
  if (next.length !== list.length) await save(next);
}

export async function clearNotificationHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
