import { openExternalLink, type OpenExternalLinkOptions } from '@/utils/openExternalLink';

/** 종목 상세·더보기 숏링크 등 공통 외부 링크 설명 */
export type ExternalLinkDescriptor = {
  webUrl: string;
  /** 앱 우선 시도 URL — iOS·iPad에서 커스텀 스킴을 https보다 먼저 시도 */
  appLaunchUrls?: string[];
  /**
   * 앱 시도 없이 인앱 브라우저로만 연다 (예: 네이버 카페).
   * `appLaunchUrls`가 있으면 무시되고 앱 우선 정책이 적용된다.
   */
  openInAppBrowser?: boolean;
};

/** `openExternalLink`에 넘길 옵션 — 앱 URL이 있으면 인앱 브라우저 강제를 끈다 */
export function resolveExternalLinkOpenOptions(
  descriptor: Pick<ExternalLinkDescriptor, 'appLaunchUrls' | 'openInAppBrowser'>,
): OpenExternalLinkOptions {
  if (descriptor.openInAppBrowser && !descriptor.appLaunchUrls?.length) {
    return { preferInAppBrowser: true };
  }
  return { preferInAppBrowserOnLinkingFailure: true };
}

/** 종목 상세·더보기 숏링크 공통 진입점 */
export async function openConfiguredExternalLink(descriptor: ExternalLinkDescriptor): Promise<void> {
  await openExternalLink(descriptor.webUrl, descriptor.appLaunchUrls, resolveExternalLinkOpenOptions(descriptor));
}
