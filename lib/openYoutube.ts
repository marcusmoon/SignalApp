import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { youtubeOpenUrl } from '@/lib/youtubeEconomy';
import { openExternalLink, youtubeWatchAppLaunchUrls } from '@/utils/openExternalLink';
import type { YoutubeItem } from '@/types/signal';

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
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync(webUrl);
    return;
  }
  await openExternalLink(webUrl, youtubeWatchAppLaunchUrls(videoId, webUrl), {
    preferInAppBrowserOnLinkingFailure: true,
  });
}
