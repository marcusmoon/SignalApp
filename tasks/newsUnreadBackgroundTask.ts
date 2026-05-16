import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { hasSignalApi } from '@/services/env';
import { loadLocale } from '@/services/localePreference';
import {
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadBackgroundIntervalSec,
} from '@/services/newsUnreadCheckIntervalPreference';
import { refreshNewsUnreadFromServer } from '@/services/newsUnreadPreference';
import { isNewsUnreadBackgroundFetchNativeAvailable } from '@/utils/expoNativeModules';

export const NEWS_UNREAD_BACKGROUND_TASK = 'signal-news-unread-check';

TaskManager.defineTask(NEWS_UNREAD_BACKGROUND_TASK, async () => {
  try {
    if (!hasSignalApi()) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const locale = await loadLocale();
    const hasUnread = await refreshNewsUnreadFromServer(locale);
    return hasUnread
      ? BackgroundFetch.BackgroundFetchResult.NewData
      : BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function registerTask(minimumIntervalSec: number): Promise<void> {
  await BackgroundFetch.registerTaskAsync(NEWS_UNREAD_BACKGROUND_TASK, {
    minimumInterval: minimumIntervalSec,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function registerNewsUnreadBackgroundFetch(): Promise<void> {
  if (!isNewsUnreadBackgroundFetchNativeAvailable()) {
    if (__DEV__) {
      console.warn(
        '[newsUnread] expo-task-manager / expo-background-fetch native modules missing. ' +
          'Run `npx expo prebuild --platform ios` (or android), then `pod install` and rebuild in Xcode.',
      );
    }
    return;
  }

  const status = await BackgroundFetch.getStatusAsync();
  if (status === BackgroundFetch.BackgroundFetchStatus.Restricted) {
    return;
  }
  const minutes = await loadNewsUnreadCheckIntervalMinutes();
  const minimumIntervalSec = newsUnreadBackgroundIntervalSec(minutes);
  const registered = await TaskManager.isTaskRegisteredAsync(NEWS_UNREAD_BACKGROUND_TASK);
  if (registered) {
    await BackgroundFetch.unregisterTaskAsync(NEWS_UNREAD_BACKGROUND_TASK);
  }
  await registerTask(minimumIntervalSec);
}

/** 설정·env 기본값 변경 후 백그라운드 간격 재등록 */
export async function syncNewsUnreadBackgroundFetchRegistration(): Promise<void> {
  await registerNewsUnreadBackgroundFetch();
}
