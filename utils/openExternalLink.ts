import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

export type OpenExternalLinkOptions = {
  /** 항상 인앱 브라우저(expo-web-browser)로 연다. */
  preferInAppBrowser?: boolean;
  /**
   * 마지막에 `Linking.openURL(webUrl)`까지 실패하면 인앱 브라우저로 연다.
   * (야후 종목, 유튜브 영상 등 — 퀵 링크는 보통 false)
   */
  preferInAppBrowserOnLinkingFailure?: boolean;
};

function toLaunchList(launchUrls?: string | string[]): string[] {
  if (launchUrls == null) return [];
  return (typeof launchUrls === 'string' ? [launchUrls] : launchUrls).filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
}

/** `youtube://`, `https://` … 및 `vnd.youtube:VIDEO_ID` */
function isLikelyCustomAppUrl(u: string): boolean {
  const lower = u.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('intent:')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:[^/]/i.test(u) && !lower.includes('://')) {
    return true;
  }
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(u);
}

function isIntentNavigationUrl(u: string): boolean {
  return u.toLowerCase().startsWith('intent:');
}

function isHttpOrHttpsUrl(u: string): boolean {
  const lower = u.toLowerCase();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function parseUrlScheme(u: string): string | null {
  const m = u.match(/^([a-z][a-z0-9+.-]*):/i);
  return m ? m[1].toLowerCase() : null;
}

/** Android intent:// 폴백: 직접 스킴 실패 시 패키지 고정 */
const ANDROID_SCHEME_TO_PACKAGE: Record<string, string> = {
  yfinance: 'com.yahoo.mobile.client.android.finance',
  yahoo: 'com.yahoo.mobile.client.android.finance',
  upbit: 'com.dunamu.exchange',
  supertoss: 'viva.republica.toss',
  bnc: 'com.binance.dev',
  binance: 'com.binance.dev',
  coinbase: 'com.coinbase.android',
  youtube: 'com.google.android.youtube',
  'vnd.youtube': 'com.google.android.youtube',
};

function androidIntentFallbackUrl(webUrl: string, scheme: string, pkg: string): string {
  const fallback = encodeURIComponent(webUrl);
  return `intent://#Intent;scheme=${scheme};package=${pkg};S.browser_fallback_url=${fallback};end`;
}

async function tryOpen(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

async function openWebUrlWithOptionalInApp(
  webUrl: string,
  preferInAppBrowser?: boolean,
  preferInAppBrowserOnLinkingFailure?: boolean,
): Promise<void> {
  if (preferInAppBrowser) {
    await WebBrowser.openBrowserAsync(webUrl);
    return;
  }
  try {
    await Linking.openURL(webUrl);
  } catch {
    if (preferInAppBrowserOnLinkingFailure) {
      await WebBrowser.openBrowserAsync(webUrl);
    }
  }
}

/**
 * Yahoo Finance: 앱 딥링크·https·인텐트 순으로 시도할 URL 목록 (`webUrl`은 종목/경로별 https).
 */
export function yahooFinanceAppLaunchUrls(webUrl: string): string[] {
  const enc = encodeURIComponent(webUrl);
  return [
    `intent://finance.yahoo.com/#Intent;scheme=https;package=com.yahoo.mobile.client.android.finance;S.browser_fallback_url=${enc};end`,
    webUrl,
    'yfinance://',
    'yahoo://',
  ];
}

/**
 * YouTube 영상: 앱 스킴·Android 인텐트·https 순.
 */
export function youtubeWatchAppLaunchUrls(videoId: string, webUrl: string): string[] {
  const vid = encodeURIComponent(videoId);
  const enc = encodeURIComponent(webUrl);
  const intent =
    `intent://www.youtube.com/watch?v=${vid}` +
    `#Intent;scheme=https;package=com.google.android.youtube;` +
    `S.browser_fallback_url=${enc};end`;
  return [
    `youtube://watch?v=${vid}`,
    `youtube://www.youtube.com/watch?v=${vid}`,
    `vnd.youtube:${videoId}`,
    intent,
    webUrl,
  ];
}

/**
 * 외부 앱 우선 → 실패 시 `webUrl`(https 등).
 * 퀵 링크, 티커 옆 Yahoo, 유튜브 카드 등 공통 진입점.
 */
export async function openExternalLink(
  webUrl: string,
  appLaunchUrls?: string | string[],
  options?: OpenExternalLinkOptions,
): Promise<void> {
  const list = toLaunchList(appLaunchUrls);
  const preferInApp = options?.preferInAppBrowser === true;
  const preferBrowserOnFailure = options?.preferInAppBrowserOnLinkingFailure === true;

  for (const url of list) {
    if (isIntentNavigationUrl(url)) {
      if (await tryOpen(url)) return;
      continue;
    }
    if (isLikelyCustomAppUrl(url)) {
      if (await tryOpen(url)) return;
      continue;
    }
    if (isHttpOrHttpsUrl(url)) {
      try {
        if (await Linking.canOpenURL(url)) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        /* 유니버설 링크 등 */
      }
      if (await tryOpen(url)) return;
      continue;
    }
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      /* next */
    }
  }

  if (Platform.OS === 'android') {
    for (const url of list) {
      if (!isLikelyCustomAppUrl(url)) continue;
      const scheme = parseUrlScheme(url);
      const pkg = scheme ? ANDROID_SCHEME_TO_PACKAGE[scheme] : null;
      if (!scheme || !pkg) continue;
      const intentUrl = androidIntentFallbackUrl(webUrl, scheme, pkg);
      if (await tryOpen(intentUrl)) return;
    }
  }

  await openWebUrlWithOptionalInApp(webUrl, preferInApp, preferBrowserOnFailure);
}
