import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@signal/notification_prefs_v1';

export type NotificationPrefs = {
  pushEnabled: boolean;
  earningsOnly: boolean;
};

const DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  earningsOnly: false,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const p = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      pushEnabled: typeof p.pushEnabled === 'boolean' ? p.pushEnabled : DEFAULTS.pushEnabled,
      earningsOnly: typeof p.earningsOnly === 'boolean' ? p.earningsOnly : DEFAULTS.earningsOnly,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationPrefs(next: Partial<NotificationPrefs>): Promise<void> {
  const cur = await loadNotificationPrefs();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...cur, ...next }));
}
