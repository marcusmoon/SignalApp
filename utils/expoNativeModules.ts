import { requireOptionalNativeModule } from 'expo-modules-core';

/** Xcode 빌드에 expo-task-manager 네이티브 모듈이 포함됐는지 */
export function isExpoTaskManagerAvailable(): boolean {
  return requireOptionalNativeModule('ExpoTaskManager') != null;
}

/** Xcode 빌드에 expo-background-fetch 네이티브 모듈이 포함됐는지 */
export function isExpoBackgroundFetchAvailable(): boolean {
  return requireOptionalNativeModule('ExpoBackgroundFetch') != null;
}

export function isNewsUnreadBackgroundFetchNativeAvailable(): boolean {
  return isExpoTaskManagerAvailable() && isExpoBackgroundFetchAvailable();
}
