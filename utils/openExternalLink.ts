import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { canAttemptNativeAppLaunch, externalLinkRuntime, isIosWebFamily, usesIosAppLinkPolicy } from '@/utils/externalLinkPlatform';
import {
  isYahooFinanceWebUrl,
  yahooFinanceIosWebSafariLaunchUrl,
} from '@/utils/yahooFinance';

export type OpenExternalLinkOptions = {
  /** 항상 인앱 브라우저(expo-web-browser)로 연다. */
  preferInAppBrowser?: boolean;
  /**
   * 앱·유니버설 링크 시도 후에도 실패하면 인앱 브라우저로 연다.
   * 네이티브(iOS·iPad·Android) 앱 우선 링크의 기본 폴백.
   */
  preferInAppBrowserOnLinkingFailure?: boolean;
  /**
   * 웹에서 앱 연동 링크 — 새 탭으로 webUrl 연다 (네이티브 앱 없음).
   * `preferInAppBrowser`가 true면 무시된다.
   */
  preferWebNewTab?: boolean;
};

function toLaunchList(launchUrls?: string | string[]): string[] {
  if (launchUrls == null) return [];
  return (typeof launchUrls === 'string' ? [launchUrls] : launchUrls).filter(
    (u): u is string => typeof u === 'string' && u.length > 0,
  );
}

/** `youtube://`, `yfinance:/quote/AAPL`, `vnd.youtube:VIDEO_ID`, `https://` … */
function isLikelyCustomAppUrl(u: string): boolean {
  const lower = u.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('intent:')) {
    return false;
  }
  if (/^[a-z][a-z0-9+.-]*:(?:\/\/|\/)/i.test(u)) {
    return true;
  }
  return /^[a-z][a-z0-9+.-]*:[^/]/i.test(u) && !lower.includes('://');
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
  naversearchapp: 'com.nhn.android.search',
  bnc: 'com.binance.dev',
  binance: 'com.binance.dev',
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

/**
 * iOS·iPad 커스텀 스킴 — openURL을 먼저 시도한다.
 * canOpenURL은 긴 쿼리 스킴에서 false가 나오는 경우가 있어(Naver inappbrowser 등)
 * 설치된 앱이 있어도 웹 폴백으로 빠질 수 있다.
 */
async function tryOpenCustomAppUrl(url: string): Promise<boolean> {
  if (await tryOpen(url)) return true;
  if (Platform.OS === 'ios') {
    try {
      if (await Linking.canOpenURL(url)) {
        return tryOpen(url);
      }
    } catch {
      return false;
    }
  }
  return false;
}

/** http(s) 유니버설 링크·중계 URL — iOS에서도 canOpenURL 없이 openURL(시스템이 앱/브라우저 라우팅) */
async function tryOpenHttpUrl(url: string): Promise<boolean> {
  return tryOpen(url);
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

/** 웹(PWA·Expo web) — 인앱 오버레이 또는 새 탭 */
async function openOnWeb(
  webUrl: string,
  options: Pick<OpenExternalLinkOptions, 'preferInAppBrowser' | 'preferWebNewTab'>,
): Promise<void> {
  if (options.preferInAppBrowser) {
    await WebBrowser.openBrowserAsync(webUrl);
    return;
  }

  if (options.preferWebNewTab && typeof window !== 'undefined' && typeof window.open === 'function') {
    const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
    if (popup) return;
  }

  await WebBrowser.openBrowserAsync(webUrl);
}

/** iOS·iPad: 커스텀 스킴 → https 순. Android·기타 웹: 전달 목록 유지 */
export function orderAppLaunchUrlsForPlatform(urls: string[], webUrl: string): string[] {
  if (!usesIosAppLinkPolicy()) return urls;

  const custom: string[] = [];
  const https: string[] = [];
  const other: string[] = [];

  for (const url of urls) {
    const lower = url.toLowerCase();
    if (lower.startsWith('intent:')) {
      other.push(url);
      continue;
    }
    if (lower.startsWith('http://') || lower.startsWith('https://')) {
      https.push(url);
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:(?:\/\/|\/)/i.test(url)) {
      custom.push(url);
      continue;
    }
    if (/^[a-z][a-z0-9+.-]*:[^/]/i.test(url) && !lower.includes('://')) {
      custom.push(url);
      continue;
    }
    other.push(url);
  }

  const ordered = [...custom, ...https, ...other];
  if (!ordered.includes(webUrl) && !https.includes(webUrl)) {
    ordered.push(webUrl);
  }
  return ordered;
}

/**
 * Yahoo Finance 홈·더보기 숏링크 — 앱 스킴 우선.
 */
export function yahooFinanceAndroidIntentUrl(webUrl: string): string {
  const enc = encodeURIComponent(webUrl);
  const path = webUrl.replace(/^https:\/\/finance\.yahoo\.com/i, '');
  return (
    `intent://finance.yahoo.com${path}` +
    `#Intent;scheme=https;package=com.yahoo.mobile.client.android.finance;S.browser_fallback_url=${enc};end`
  );
}

/** 서비스 홈(더보기 숏링크) — iOS·iPad는 https 유니버설 링크, Android는 intent 후 https */
export function webHomeAppLaunchUrls(webUrl: string, androidIntentUrl?: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;
  if (usesIosAppLinkPolicy()) return [webUrl];
  if (Platform.OS === 'android' && androidIntentUrl) {
    return [androidIntentUrl, webUrl];
  }
  return [webUrl];
}

export function upbitAndroidIntentUrl(webUrl: string): string {
  const enc = encodeURIComponent(webUrl);
  const path = webUrl.replace(/^https:\/\/upbit\.com/i, '');
  return (
    `intent://upbit.com${path}` +
    `#Intent;scheme=https;package=com.dunamu.exchange;S.browser_fallback_url=${enc};end`
  );
}

export function binanceAndroidIntentUrl(webUrl: string): string {
  const enc = encodeURIComponent(webUrl);
  const path = webUrl.replace(/^https:\/\/www\.binance\.com/i, '');
  return (
    `intent://www.binance.com${path}` +
    `#Intent;scheme=https;package=com.binance.dev;S.browser_fallback_url=${enc};end`
  );
}

export function upbitHomeAppLaunchUrls(webUrl: string): string[] | undefined {
  return webHomeAppLaunchUrls(webUrl, upbitAndroidIntentUrl(webUrl));
}

export function binanceHomeAppLaunchUrls(webUrl: string): string[] | undefined {
  return webHomeAppLaunchUrls(webUrl, binanceAndroidIntentUrl(webUrl));
}

/**
 * Yahoo Finance 홈·더보기 숏링크 — Android intent. iOS는 `yahooFinanceHomeAppLaunchUrls`.
 * @deprecated `yahooFinance.ts`의 `yahooFinanceHomeAppLaunchUrls` 사용
 */
export function yahooFinanceAppLaunchUrls(webUrl: string): string[] | undefined {
  return webHomeAppLaunchUrls(webUrl, yahooFinanceAndroidIntentUrl(webUrl));
}

/**
 * YouTube 영상: 앱 스킴·Android 인텐트·https 순.
 */
export function youtubeWatchAppLaunchUrls(videoId: string, webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;

  const vid = encodeURIComponent(videoId);
  const enc = encodeURIComponent(webUrl);
  const intent =
    `intent://www.youtube.com/watch?v=${vid}` +
    `#Intent;scheme=https;package=com.google.android.youtube;` +
    `S.browser_fallback_url=${enc};end`;
  const base = [
    `youtube://watch?v=${vid}`,
    `youtube://www.youtube.com/watch?v=${vid}`,
    `vnd.youtube:${videoId}`,
    intent,
    webUrl,
  ];
  return orderAppLaunchUrlsForPlatform(base, webUrl);
}

const IOS_WEB_APP_SCHEME_TIMEOUT_MS = 1200;

/** iPhone Safari — 커스텀 스킴 시도 시 Safari "invalid address" 알림을 띄우는 스킴 */
const IOS_WEB_BLOCKED_CUSTOM_SCHEMES = new Set([
  'yfinance',
  'yahoo',
  'youtube',
  'vnd.youtube',
]);

function iosWebAllowsCustomScheme(url: string): boolean {
  const scheme = parseUrlScheme(url);
  if (!scheme) return false;
  return !IOS_WEB_BLOCKED_CUSTOM_SCHEMES.has(scheme);
}

/** iPhone·iPad Safari — 사용자 제스처 체인에서 앱 스킴·https 내비게이션 */
function iosWebNavigateViaAnchor(url: string, options?: { newTab?: boolean }): void {
  if (typeof document === 'undefined') return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.rel = 'noopener noreferrer';
  if (options?.newTab && isHttpOrHttpsUrl(url)) {
    anchor.target = '_blank';
  }
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function waitForIosWebAppHandoff(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve(false);
      return;
    }
    if (document.hidden) {
      resolve(true);
      return;
    }

    let settled = false;
    const finish = (opened: boolean) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(timer);
      resolve(opened);
    };

    const onVisibilityChange = () => {
      if (document.hidden) finish(true);
    };
    const onPageHide = () => finish(true);
    const onBlur = () => finish(true);

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('blur', onBlur);
    const timer = window.setTimeout(() => finish(false), timeoutMs);
  });
}

function iosWebOpenHttpsInNewTab(url: string): boolean {
  if (typeof window === 'undefined' || !isHttpOrHttpsUrl(url)) return false;
  iosWebNavigateViaAnchor(url, { newTab: true });
  return true;
}

/**
 * iPhone Safari + Yahoo — host 스킴 → 동일 탭 https(유니버설 링크) → 새 탭 https.
 * 새 탭만 쓰면 iOS가 앱으로 넘기지 않고 Safari 웹만 열리는 경우가 많다.
 */
async function tryIosWebYahooLaunch(webUrl: string): Promise<boolean> {
  const scheme = yahooFinanceIosWebSafariLaunchUrl(webUrl);
  if (scheme) {
    iosWebNavigateViaAnchor(scheme);
    if (await waitForIosWebAppHandoff(IOS_WEB_APP_SCHEME_TIMEOUT_MS)) return true;
  }

  if (isHttpOrHttpsUrl(webUrl)) {
    iosWebNavigateViaAnchor(webUrl);
    if (await waitForIosWebAppHandoff(IOS_WEB_APP_SCHEME_TIMEOUT_MS)) return true;
  }

  return iosWebOpenHttpsInNewTab(webUrl);
}

/**
 * iPhone·iPad Safari — 토스·네이버 등 허용 스킴 후 https 새 탭. Yahoo는 별도 처리.
 */
async function tryIosWebAppLaunchUrls(list: string[], webUrl: string): Promise<boolean> {
  if (isYahooFinanceWebUrl(webUrl)) {
    return tryIosWebYahooLaunch(webUrl);
  }

  const ordered = orderAppLaunchUrlsForPlatform(list.length > 0 ? list : [], webUrl);
  const unique = ordered.filter((url, index, arr) => url.length > 0 && arr.indexOf(url) === index);

  const customs = unique.filter(
    (url) =>
      !isIntentNavigationUrl(url) && isLikelyCustomAppUrl(url) && iosWebAllowsCustomScheme(url),
  );
  const httpsUrls = unique.filter((url) => isHttpOrHttpsUrl(url));
  const fallbackHttps = httpsUrls[0] ?? webUrl;

  if (customs.length > 0) {
    iosWebNavigateViaAnchor(customs[0]);
    const handedOff = await waitForIosWebAppHandoff(IOS_WEB_APP_SCHEME_TIMEOUT_MS);
    if (handedOff) return true;
  }

  return iosWebOpenHttpsInNewTab(fallbackHttps);
}

async function tryNativeAppLaunchUrls(list: string[], webUrl: string): Promise<boolean> {
  for (const url of list) {
    if (isIntentNavigationUrl(url)) {
      if (await tryOpen(url)) return true;
      continue;
    }
    if (isLikelyCustomAppUrl(url)) {
      if (await tryOpenCustomAppUrl(url)) return true;
      continue;
    }
    if (isHttpOrHttpsUrl(url)) {
      if (await tryOpenHttpUrl(url)) return true;
      continue;
    }
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        return true;
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
      if (await tryOpen(intentUrl)) return true;
    }
  }

  return false;
}

/**
 * 외부 링크 공통 진입점 — iPhone·iPad·Android·웹 정책 분기.
 *
 * | 런타임 | openInAppBrowser | appLaunchUrls | 동작 |
 * |---|---|---|---|
 * | 데스크톱·Android 웹 | true | — | 인앱 브라우저 |
 * | 데스크톱·Android 웹 | false | 있음/없음 | 새 탭 → 실패 시 인앱 브라우저 |
 * | iPhone·iPad Safari 웹 | false | 있음 | 허용 스킴(토스·네이버 등) → https **새 탭** → 실패 시 인앱 폴백. Yahoo 스킴 생략 |
 * | iOS·iPad·Android 네이티브 | true | — | 인앱 브라우저 |
 * | iOS·iPad·Android 네이티브 | false | 있음 | 커스텀 스킴 → https(유니버설) → 미지원 시 외부 브라우저 |
 */
export async function openExternalLink(
  webUrl: string,
  appLaunchUrls?: string | string[],
  options?: OpenExternalLinkOptions,
): Promise<void> {
  const list = toLaunchList(appLaunchUrls);
  const preferInApp = options?.preferInAppBrowser === true;
  const preferBrowserOnFailure = options?.preferInAppBrowserOnLinkingFailure === true;
  const preferWebNewTab = options?.preferWebNewTab === true;
  const runtime = externalLinkRuntime();

  if (runtime === 'web' && isIosWebFamily()) {
    if (preferInApp) {
      await WebBrowser.openBrowserAsync(webUrl);
      return;
    }
    if (list.length > 0) {
      const opened = await tryIosWebAppLaunchUrls(list, webUrl);
      if (opened) return;
    }
    if (preferBrowserOnFailure) {
      await WebBrowser.openBrowserAsync(webUrl);
      return;
    }
    await openOnWeb(webUrl, { preferInAppBrowser: false, preferWebNewTab: true });
    return;
  }

  if (runtime === 'web') {
    await openOnWeb(webUrl, { preferInAppBrowser: preferInApp, preferWebNewTab });
    return;
  }

  if (list.length > 0) {
    const opened = await tryNativeAppLaunchUrls(list, webUrl);
    if (opened) return;
  }

  await openWebUrlWithOptionalInApp(webUrl, preferInApp, preferBrowserOnFailure);
}
