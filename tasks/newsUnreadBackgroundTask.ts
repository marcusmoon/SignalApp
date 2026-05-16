import { isRunningInExpoGo } from 'expo';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { hasSignalApi } from '@/services/env';
import { loadLocale } from '@/services/localePreference';
import {
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadBackgroundTaskIntervalMinutes,
} from '@/services/newsUnreadCheckIntervalPreference';
import { refreshNewsUnreadFromServer } from '@/services/newsUnreadPreference';
import { isNewsUnreadBackgroundTaskNativeAvailable } from '@/utils/expoNativeModules';

export const NEWS_UNREAD_BACKGROUND_TASK = 'signal-news-unread-check';

TaskManager.defineTask(NEWS_UNREAD_BACKGROUND_TASK, async () => {
  try {
    if (!hasSignalApi()) {
      return BackgroundTask.BackgroundTaskResult.Success;
    }
    const locale = await loadLocale();
    await refreshNewsUnreadFromServer(locale);
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

async function registerTask(minimumIntervalMinutes: number): Promise<void> {
  await BackgroundTask.registerTaskAsync(NEWS_UNREAD_BACKGROUND_TASK, {
    minimumInterval: minimumIntervalMinutes,
  });
}

export async function registerNewsUnreadBackgroundFetch(): Promise<void> {
  if (isRunningInExpoGo()) {
    return;
  }

  if (!isNewsUnreadBackgroundTaskNativeAvailable()) {
    if (__DEV__) {
      console.warn(
        '[newsUnread] expo-task-manager / expo-background-task native modules missing. ' +
          'Run `npx expo prebuild --platform ios` (or android), then `pod install` and rebuild in Xcode.',
      );
    }
    return;
  }

  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) {
    return;
  }

  const minutes = await loadNewsUnreadCheckIntervalMinutes();
  const minimumIntervalMinutes = newsUnreadBackgroundTaskIntervalMinutes(minutes);
  const registered = await TaskManager.isTaskRegisteredAsync(NEWS_UNREAD_BACKGROUND_TASK);
  if (registered) {
    await BackgroundTask.unregisterTaskAsync(NEWS_UNREAD_BACKGROUND_TASK);
  }
  await registerTask(minimumIntervalMinutes);
}

/** 설정·env 기본값 변경 후 백그라운드 간격 재등록 */
export async function syncNewsUnreadBackgroundFetchRegistration(): Promise<void> {
  await registerNewsUnreadBackgroundFetch();
}
