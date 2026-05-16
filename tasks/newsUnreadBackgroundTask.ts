import { isRunningInExpoGo } from 'expo';

import { hasSignalApi } from '@/services/env';
import { loadLocale } from '@/services/localePreference';
import {
  loadNewsUnreadCheckIntervalMinutes,
  newsUnreadBackgroundTaskIntervalMinutes,
} from '@/services/newsUnreadCheckIntervalPreference';
import { refreshNewsUnreadFromServer } from '@/services/newsUnreadPreference';
import { isNewsUnreadBackgroundTaskNativeAvailable } from '@/utils/expoNativeModules';

export const NEWS_UNREAD_BACKGROUND_TASK = 'signal-news-unread-check';

type BackgroundTaskModule = typeof import('expo-background-task');
type TaskManagerModule = typeof import('expo-task-manager');

type BackgroundTaskModules = {
  BackgroundTask: BackgroundTaskModule;
  TaskManager: TaskManagerModule;
};

let taskDefined = false;

function loadBackgroundTaskModules(): BackgroundTaskModules | null {
  if (!isNewsUnreadBackgroundTaskNativeAvailable()) return null;
  try {
    return {
      // Native module이 없는 빌드에서는 require 시점에 예외가 발생하므로 static import 금지.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      BackgroundTask: require('expo-background-task') as BackgroundTaskModule,
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      TaskManager: require('expo-task-manager') as TaskManagerModule,
    };
  } catch {
    return null;
  }
}

function ensureNewsUnreadTaskDefined(): BackgroundTaskModules | null {
  const modules = loadBackgroundTaskModules();
  if (!modules || taskDefined) return modules;

  modules.TaskManager.defineTask(NEWS_UNREAD_BACKGROUND_TASK, async () => {
    try {
      if (!hasSignalApi()) {
        return modules.BackgroundTask.BackgroundTaskResult.Success;
      }
      const locale = await loadLocale();
      await refreshNewsUnreadFromServer(locale);
      return modules.BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return modules.BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
  taskDefined = true;
  return modules;
}

async function registerTask(minimumIntervalMinutes: number): Promise<void> {
  const modules = ensureNewsUnreadTaskDefined();
  if (!modules) return;

  await modules.BackgroundTask.registerTaskAsync(NEWS_UNREAD_BACKGROUND_TASK, {
    minimumInterval: minimumIntervalMinutes,
  });
}

export async function registerNewsUnreadBackgroundFetch(): Promise<void> {
  if (isRunningInExpoGo()) {
    return;
  }

  const modules = ensureNewsUnreadTaskDefined();
  if (!modules) {
    if (__DEV__) {
      console.warn(
        '[newsUnread] expo-task-manager / expo-background-task native modules missing. ' +
          'Run `npx expo prebuild --platform ios` (or android), then `pod install` and rebuild in Xcode.',
      );
    }
    return;
  }

  const status = await modules.BackgroundTask.getStatusAsync();
  if (status === modules.BackgroundTask.BackgroundTaskStatus.Restricted) {
    return;
  }

  const minutes = await loadNewsUnreadCheckIntervalMinutes();
  const minimumIntervalMinutes = newsUnreadBackgroundTaskIntervalMinutes(minutes);
  const registered = await modules.TaskManager.isTaskRegisteredAsync(NEWS_UNREAD_BACKGROUND_TASK);
  if (registered) {
    await modules.BackgroundTask.unregisterTaskAsync(NEWS_UNREAD_BACKGROUND_TASK);
  }
  await registerTask(minimumIntervalMinutes);
}

/** 설정·env 기본값 변경 후 백그라운드 간격 재등록 */
export async function syncNewsUnreadBackgroundFetchRegistration(): Promise<void> {
  await registerNewsUnreadBackgroundFetch();
}
