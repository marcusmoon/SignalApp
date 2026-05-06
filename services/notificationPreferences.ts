import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@signal/notification_prefs_v1';

export type NotificationPrefs = {
  pushEnabled: boolean;
  earningsOnly: boolean;
  /** 서버 Insight Job이 만든 오늘의 시그널 pushCandidate를 알림 후보로 보여줌 */
  signalAlertsEnabled: boolean;
  /** 알림 후보를 기기 관심종목과 매칭되는 시그널로 좁힘 */
  signalWatchlistOnly: boolean;
  /** 기기 로컬 알림: CPI·FOMC 등 경제 캘린더(다음 10일, 하루 1회 요약 시각) */
  localMacroCalendar: boolean;
  /** 기기 로컬 알림: 관심 종목 실적 일정(당일 오전) */
  localWatchlistEarnings: boolean;
};

const DEFAULTS: NotificationPrefs = {
  pushEnabled: true,
  earningsOnly: false,
  signalAlertsEnabled: true,
  signalWatchlistOnly: true,
  localMacroCalendar: false,
  localWatchlistEarnings: false,
};

export async function loadNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { ...DEFAULTS };
  try {
    const p = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      pushEnabled: typeof p.pushEnabled === 'boolean' ? p.pushEnabled : DEFAULTS.pushEnabled,
      earningsOnly: typeof p.earningsOnly === 'boolean' ? p.earningsOnly : DEFAULTS.earningsOnly,
      signalAlertsEnabled:
        typeof p.signalAlertsEnabled === 'boolean' ? p.signalAlertsEnabled : DEFAULTS.signalAlertsEnabled,
      signalWatchlistOnly:
        typeof p.signalWatchlistOnly === 'boolean' ? p.signalWatchlistOnly : DEFAULTS.signalWatchlistOnly,
      localMacroCalendar:
        typeof p.localMacroCalendar === 'boolean' ? p.localMacroCalendar : DEFAULTS.localMacroCalendar,
      localWatchlistEarnings:
        typeof p.localWatchlistEarnings === 'boolean'
          ? p.localWatchlistEarnings
          : DEFAULTS.localWatchlistEarnings,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveNotificationPrefs(next: Partial<NotificationPrefs>): Promise<void> {
  const cur = await loadNotificationPrefs();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...cur, ...next }));
}
