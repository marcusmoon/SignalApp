import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { appendNotificationFromPayload } from '@/services/notificationHistory';
import { setAlertsUnreadCached } from '@/services/alertsUnreadPreference';
import {
  loadNotificationPrefs,
  shouldRecordIncomingPush,
} from '@/services/notificationPreferences';
import { setSignalUnreadCached } from '@/services/signalUnreadPreference';

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const prefs = await loadNotificationPrefs();
        const show = shouldRecordIncomingPush(String(data?.type || ''), String(data?.sourceType || ''), prefs);
        return {
          shouldShowBanner: show,
          shouldShowList: show,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      },
    });
  } catch {
    /* 일부 빌드/시뮬레이터에서 네이티브 모듈 미초기화 시 throw 가능 */
  }
}

/**
 * Records incoming push payloads into local history (AsyncStorage).
 * Requires FCM/APNs + expo-notifications; web is skipped.
 */
export function NotificationListener() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const record = (n: Notifications.Notification) => {
      const c = n.request.content;
      const data = c.data as Record<string, unknown> | undefined;
      const type = String(data?.type || '');
      const sourceType = String(data?.sourceType || '');
      void loadNotificationPrefs().then((prefs) => {
        if (!shouldRecordIncomingPush(type, sourceType, prefs)) return;
        void setAlertsUnreadCached(true);
        if (
          type === 'market_briefing' ||
          sourceType === 'market_briefing' ||
          type === 'today_briefing' ||
          sourceType === 'today_briefing'
        ) {
          void setSignalUnreadCached(true);
        }
        void appendNotificationFromPayload({
          title: String(c.title ?? ''),
          body: String(c.body ?? ''),
          data,
        });
      });
    };

    const sub = Notifications.addNotificationReceivedListener(record);

    const sub2 = Notifications.addNotificationResponseReceivedListener((response) => {
      record(response.notification);
    });

    return () => {
      sub.remove();
      sub2.remove();
    };
  }, []);

  return null;
}
