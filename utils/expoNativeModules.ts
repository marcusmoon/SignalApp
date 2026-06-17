import { requireOptionalNativeModule } from 'expo';

/** Xcode 빌드에 expo-task-manager 네이티브 모듈이 포함됐는지 */
export function isExpoTaskManagerAvailable(): boolean {
  return requireOptionalNativeModule('ExpoTaskManager') != null;
}

/** Xcode 빌드에 expo-background-task 네이티브 모듈이 포함됐는지 */
export function isExpoBackgroundTaskAvailable(): boolean {
  return requireOptionalNativeModule('ExpoBackgroundTask') != null;
}

export function isNewsUnreadBackgroundTaskNativeAvailable(): boolean {
  return isExpoTaskManagerAvailable() && isExpoBackgroundTaskAvailable();
}
