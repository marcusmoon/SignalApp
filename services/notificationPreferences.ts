import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@signal/notification_prefs_v1';

export type NotificationPrefs = {
  /** OS 권한 + 서버 디바이스 등록 마스터 */
  pushEnabled: boolean;
  /** market wrap · news flow · market briefing 푸시 수신 */
  briefingPushEnabled: boolean;
  /** 기기 로컬 알림: CPI·FOMC 등 경제 캘린더(다음 10일, 하루 1회 요약 시각) */
  localMacroCalendar: boolean;
};

export type ServerNotificationPrefs = Pick<NotificationPrefs, 'pushEnabled' | 'briefingPushEnabled'>;

const DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  briefingPushEnabled: true,
  localMacroCalendar: false,
};

export function shouldRecordIncomingPush(
  type: string,
  sourceType: string,
  prefs: NotificationPrefs,
): boolean {
  if (!prefs.pushEnabled) return false;
  const normalizedType = String(type || '').toLowerCase();
  const normalizedSource = String(sourceType || '').toLowerCase();
  const isBriefingPush =
    normalizedType === 'market_briefing' ||
    normalizedSource === 'market_briefing' ||
    normalizedType === 'today_briefing' ||
    normalizedSource === 'today_briefing' ||
    normalizedType === 'news_digest' ||
    normalizedSource === 'news_digest';
  if (isBriefingPush) {
    return prefs.briefingPushEnabled;
  }
  return true;
}

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const p = JSON.parse(raw) as Partial<NotificationPrefs> & {
      earningsOnly?: boolean;
      localWatchlistEarnings?: boolean;
      signalAlertsEnabled?: boolean;
      signalWatchlistOnly?: boolean;
    };
    return {
      pushEnabled: typeof p.pushEnabled === 'boolean' ? p.pushEnabled : DEFAULTS.pushEnabled,
      briefingPushEnabled:
        typeof p.briefingPushEnabled === 'boolean' ? p.briefingPushEnabled : DEFAULTS.briefingPushEnabled,
      localMacroCalendar:
        typeof p.localMacroCalendar === 'boolean' ? p.localMacroCalendar : DEFAULTS.localMacroCalendar,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationPrefs(next: Partial<NotificationPrefs>): Promise<void> {
  const cur = await loadNotificationPrefs();
  const merged = { ...cur, ...next };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
  void syncServerNotificationPrefs(merged);
}

async function syncServerNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  try {
    const { hasSignalApi } = await import('@/services/env');
    if (!hasSignalApi()) return;
    const { getSessionAccessToken, loadAppAuthSession } = await import('@/services/appAuthSession');
    const { updateSignalNotificationPrefs } = await import('@/integrations/signal-api/notifications');
    const session = await loadAppAuthSession();
    const access = getSessionAccessToken(session);
    if (!access) return;
    await updateSignalNotificationPrefs(access, {
      pushEnabled: prefs.pushEnabled,
      briefingPushEnabled: prefs.briefingPushEnabled,
    });
  } catch {
    /* local prefs remain source of truth for UI */
  }
}

export async function syncNotificationPrefsFromLocal(): Promise<void> {
  await syncServerNotificationPrefs(await loadNotificationPrefs());
}
