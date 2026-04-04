import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { appendNotificationFromPayload } from '@/services/notificationHistory';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
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
      void appendNotificationFromPayload({
        title: String(c.title ?? ''),
        body: String(c.body ?? ''),
        data: c.data as Record<string, unknown> | undefined,
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
