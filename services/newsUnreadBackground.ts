import { AppState, Platform, type AppStateStatus } from 'react-native';

import { subscribeNewsUnreadCheckIntervalChanged } from '@/services/newsUnreadCheckIntervalPreference';
import {
  registerNewsUnreadBackgroundFetch,
  syncNewsUnreadBackgroundFetchRegistration,
} from '@/tasks/newsUnreadBackgroundTask';
import { hasSignalApi } from '@/services/env';
import { loadLocale } from '@/services/localePreference';
import { refreshNewsUnreadFromServer } from '@/services/newsUnreadPreference';

let appStateSub: { remove: () => void } | null = null;
let intervalSub: (() => void) | null = null;

async function runBackgroundNewsCheck(): Promise<void> {
  if (!hasSignalApi()) return;
  const locale = await loadLocale();
  await refreshNewsUnreadFromServer(locale);
}

function onAppStateChange(next: AppStateStatus): void {
  if (next === 'background' || next === 'inactive') {
    void runBackgroundNewsCheck();
  }
}

/** 포그라운드 주기 폴링 + 백그라운드 fetch·앱 전환 시 서버 확인 */
export function startNewsUnreadBackgroundSync(): () => void {
  if (Platform.OS === 'web') {
    return () => {};
  }

  void registerNewsUnreadBackgroundFetch().catch(() => {});

  if (!intervalSub) {
    intervalSub = subscribeNewsUnreadCheckIntervalChanged(() => {
      void syncNewsUnreadBackgroundFetchRegistration().catch(() => {});
    });
  }

  if (!appStateSub) {
    appStateSub = AppState.addEventListener('change', onAppStateChange);
  }

  return () => {
    intervalSub?.();
    intervalSub = null;
    appStateSub?.remove();
    appStateSub = null;
  };
}
