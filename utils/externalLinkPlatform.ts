import { Platform } from 'react-native';

/** RN 기준 런타임 — iPad도 `ios` */
export type ExternalLinkRuntime = 'ios' | 'android' | 'web';

export function externalLinkRuntime(): ExternalLinkRuntime {
  if (Platform.OS === 'web') return 'web';
  if (Platform.OS === 'ios') return 'ios';
  return 'android';
}

/** iPhone·iPad 네이티브 */
export function isIosFamily(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Expo web를 iPhone·iPad Safari(또는 홈 화면 PWA)에서 연 경우.
 * iPadOS 데스크톱 UA는 `MacIntel` + 터치 포인트로 보조 판별.
 */
export function isIosWebFamily(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * iOS 앱 우선 링크 정책 — 네이티브(iPhone·iPad)와 동일 기기의 iOS Safari 웹.
 * 데스크톱·Android Chrome 웹은 제외.
 */
export function usesIosAppLinkPolicy(): boolean {
  return isIosFamily() || isIosWebFamily();
}

/** 앱 스킴·유니버설 링크 시도 가능 (iOS Safari 웹·네이티브 iOS·Android 앱) */
export function canAttemptNativeAppLaunch(): boolean {
  return usesIosAppLinkPolicy() || Platform.OS === 'android';
}
