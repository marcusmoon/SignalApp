import { Platform } from 'react-native';

import { canAttemptNativeAppLaunch } from '@/utils/externalLinkPlatform';
import { orderAppLaunchUrlsForPlatform } from '@/utils/openExternalLink';

/**
 * 네이티브 전용 launch 목록 — 웹은 `undefined`(openExternalLink가 webUrl만 처리).
 * iOS·iPad는 `orderAppLaunchUrlsForPlatform`으로 스킴 → https 유니버설 링크 순 정렬.
 */
export function nativeAppLaunchUrls(
  webUrl: string,
  spec: {
    ios?: readonly string[];
    android?: readonly string[];
    /** false면 iOS에 webUrl 자동 append 안 함(네이버 등 https 폴백 분리용) */
    iosAppendUniversalLink?: boolean;
  },
): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;

  if (Platform.OS === 'android' && spec.android?.length) {
    return [...spec.android];
  }

  if (Platform.OS === 'ios' && spec.ios?.length) {
    if (spec.iosAppendUniversalLink === false) {
      return [...spec.ios];
    }
    return orderAppLaunchUrlsForPlatform([...spec.ios], webUrl);
  }

  return undefined;
}
