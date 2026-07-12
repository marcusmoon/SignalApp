import { Platform } from 'react-native';

/** RN 기준 런타임 — iPad도 `ios` */
export type ExternalLinkRuntime = 'ios' | 'android' | 'web';

export function externalLinkRuntime(): ExternalLinkRuntime {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'ios') return 'ios';
  return 'android';
}

/** iPhone·iPad */
export function isIosFamily(): boolean {
  return Platform.OS === 'ios';
}

/** 네이티브 앱 스킴·intent 시도 가능 (웹 제외) */
export function canAttemptNativeAppLaunch(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
