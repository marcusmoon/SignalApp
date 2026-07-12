import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { youtubeOpenUrl } from '@/domain/youtube';
import type { YoutubeItem } from '@/types/signal';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { isIosWebFamily } from '@/utils/externalLinkPlatform';
import { youtubeWatchAppLaunchUrls } from '@/utils/openExternalLink';

/**
 * 단일 영상: `openExternalLink`(YouTube 앱 스킴·인텐트·https) 우선,
 * 검색 URL만 있는 경우: 인앱 브라우저로 연다.
 */
export async function openYoutubeItem(item: YoutubeItem): Promise<void> {
  const webUrl = youtubeOpenUrl(item);
  if (item.videoId) {
    await openYoutubeWatch(item.videoId, webUrl);
    return;
  }
  await WebBrowser.openBrowserAsync(webUrl);
}

async function openYoutubeWatch(videoId: string, webUrl: string): Promise<void> {
  if (Platform.OS === 'web' && !isIosWebFamily()) {
    await WebBrowser.openBrowserAsync(webUrl);
    return;
  }
  await openConfiguredExternalLink({
    webUrl,
    appLaunchUrls: youtubeWatchAppLaunchUrls(videoId, webUrl),
  });
}
