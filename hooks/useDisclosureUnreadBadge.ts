import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { hasSignalApi } from '@/services/env';
import {
  loadDisclosureUnreadCached,
  refreshDisclosureUnreadFromServer,
  subscribeDisclosureSeenChanged,
} from '@/services/disclosureUnreadPreference';

/** 공시 탭·더보기 허브용 — 최신 공시 id와 마지막 읽음 id 비교 */
export function useDisclosureUnreadBadge(): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  const refresh = useCallback(async () => {
    if (!hasSignalApi()) {
      setHasUnread(false);
      return;
    }
    try {
      setHasUnread(await refreshDisclosureUnreadFromServer());
    } catch {
      const cached = await loadDisclosureUnreadCached();
      if (cached !== null) setHasUnread(cached);
    }
  }, []);

  useEffect(() => {
    void loadDisclosureUnreadCached().then((cached) => {
      if (cached === true) setHasUnread(true);
    });
    void refresh();
    const unsubscribe = subscribeDisclosureSeenChanged(() => {
      void loadDisclosureUnreadCached().then((cached) => {
        if (cached !== null) setHasUnread(cached);
      });
    });
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => {
      unsubscribe();
      appSub.remove();
    };
  }, [refresh]);

  return hasUnread;
}
