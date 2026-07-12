import type { ReferenceLinkItem } from '@/constants/referenceAppLinks';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { buildAppLaunchUrls } from '@/utils/externalLinkRegistry';

/** @deprecated `buildAppLaunchUrls` 사용 */
export function buildReferenceAppLaunchUrls(
  item: Pick<ReferenceLinkItem, 'id' | 'webUrl'>,
): string[] | undefined {
  return buildAppLaunchUrls({ webUrl: item.webUrl, linkId: item.id });
}

/** 더보기 숏링크 — 플랫폼별 앱 우선·웹 새 탭/인앱 폴백 */
export async function openReferenceLink(item: ReferenceLinkItem): Promise<void> {
  if (item.openInAppBrowser) {
    await openConfiguredExternalLink({
      webUrl: item.webUrl,
      openInAppBrowser: true,
    });
    return;
  }

  await openConfiguredExternalLink({
    webUrl: item.webUrl,
    appLaunchUrls: buildAppLaunchUrls({ webUrl: item.webUrl, linkId: item.id }),
  });
}
