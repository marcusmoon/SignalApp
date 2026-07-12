import { Platform } from 'react-native';

import { openExternalLink, type OpenExternalLinkOptions } from '@/utils/openExternalLink';
import { canAttemptNativeAppLaunch } from '@/utils/externalLinkPlatform';

/** 종목 상세·더보기 숏링크 등 공통 외부 링크 설명 */
export type ExternalLinkDescriptor = {
  webUrl: string;
  /** 앱 우선 시도 URL — iOS·iPad·Android만. 웹은 무시되고 webUrl만 연다. */
  appLaunchUrls?: string[];
  /**
   * 앱 시도 없이 인앱 브라우저(웹) / 새 탭(웹)으로만 연다.
   * `appLaunchUrls`가 있으면 무시되고 앱 우선 정책이 적용된다.
   */
  openInAppBrowser?: boolean;
};

/** `openExternalLink`에 넘길 옵션 — 플랫폼별 기본 폴백 */
export function resolveExternalLinkOpenOptions(
  descriptor: Pick<ExternalLinkDescriptor, 'appLaunchUrls' | 'openInAppBrowser'>,
): OpenExternalLinkOptions {
  if (descriptor.openInAppBrowser && !descriptor.appLaunchUrls?.length) {
    return { preferInAppBrowser: true };
  }

  if (Platform.OS === 'web') {
    return { preferWebNewTab: true };
  }

  if (descriptor.appLaunchUrls?.length && canAttemptNativeAppLaunch()) {
    return { preferInAppBrowserOnLinkingFailure: true };
  }

  return { preferInAppBrowserOnLinkingFailure: true };
}

/** 종목 상세·더보기 숏링크 공통 진입점 */
export async function openConfiguredExternalLink(descriptor: ExternalLinkDescriptor): Promise<void> {
  await openExternalLink(descriptor.webUrl, descriptor.appLaunchUrls, resolveExternalLinkOpenOptions(descriptor));
}
