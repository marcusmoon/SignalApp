import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { youtubeOpenUrl } from '@/lib/youtubeEconomy';
import type { YoutubeItem } from '@/types/signal';

/**
 * 단일 영상: 네이티브 YouTube 앱 우선, 실패 시 시스템이 https 처리 → 마지막으로 인앱 브라우저.
 * 검색 URL만 있는 경우: https만 연다.
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

  /** 시스템 기본(유튜브 앱·Safari·Chrome) — 인앱 브라우저보다 유튜브 앱 연결에 유리 */
  const openHttpsExternally = async () => {
    try {
      await Linking.openURL(webUrl);
    } catch {
      await WebBrowser.openBrowserAsync(webUrl);
    }
  };

  if (Platform.OS === 'ios') {
    const appUrls = [
      `youtube://watch?v=${encodeURIComponent(videoId)}`,
      `youtube://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    ];
    for (const u of appUrls) {
      try {
        await Linking.openURL(u);
        return;
      } catch {
        /* 다음 스킴 시도 */
      }
    }
    await openHttpsExternally();
    return;
  }

  if (Platform.OS === 'android') {
    const encodedFallback = encodeURIComponent(webUrl);
    const intentWithFallback =
      `intent://www.youtube.com/watch?v=${encodeURIComponent(videoId)}` +
      `#Intent;scheme=https;package=com.google.android.youtube;` +
      `S.browser_fallback_url=${encodedFallback};end`;
    const candidates = [
      `vnd.youtube:${videoId}`,
      `youtube://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
      intentWithFallback,
    ];
    for (const u of candidates) {
      try {
        await Linking.openURL(u);
        return;
      } catch {
        /* 다음 */
      }
    }
    await openHttpsExternally();
    return;
  }

  await WebBrowser.openBrowserAsync(webUrl);
}
