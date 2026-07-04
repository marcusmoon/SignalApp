import { usePathname } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import {
  loadAlertsUnreadCached,
  refreshAlertsUnreadFromServer,
  subscribeAlertsUnreadChanged,
} from '@/services/alertsUnreadPreference';

export function useAlertsUnreadBadge(): boolean {
  const pathname = usePathname();
  const onAlertsScreen = pathname.includes('/alerts');
  const [hasUnread, setHasUnread] = useState(false);

  const refresh = useCallback(async () => {
    if (onAlertsScreen) {
      setHasUnread(false);
      return;
    }
    try {
      setHasUnread(await refreshAlertsUnreadFromServer());
    } catch {
      const cached = await loadAlertsUnreadCached();
      if (cached !== null) setHasUnread(cached);
    }
  }, [onAlertsScreen]);

  useEffect(() => {
    if (onAlertsScreen) {
      setHasUnread(false);
      return;
    }
    void loadAlertsUnreadCached().then((cached) => {
      if (cached === true) setHasUnread(true);
    });
    void refresh();
    const unsubscribe = subscribeAlertsUnreadChanged(() => {
      void loadAlertsUnreadCached().then((cached) => {
        if (cached !== null) setHasUnread(cached);
      });
    });
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    const poll = setInterval(() => void refresh(), 3 * 60 * 1000);
    return () => {
      unsubscribe();
      appSub.remove();
      clearInterval(poll);
    };
  }, [onAlertsScreen, refresh]);

  return onAlertsScreen ? false : hasUnread;
}
