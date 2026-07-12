import { Platform } from 'react-native';

import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';

function normalizeKrxCode(symbol: string): string | null {
  const digits = String(symbol || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

/** 토스증권 종목 상세(주문) 웹 URL — 한국 6자리·미국 티커 */
export function tossFinanceStockUrl(symbol: string): string | null {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return null;

  const krx = normalizeKrxCode(trimmed);
  if (krx) {
    return `https://www.tossinvest.com/stocks/${encodeURIComponent(krx)}/order`;
  }

  if (/^[A-Z][A-Z0-9.-]{0,14}$/.test(trimmed)) {
    return `https://www.tossinvest.com/stocks/${encodeURIComponent(trimmed)}/order`;
  }

  return null;
}

export function tossInvestAndroidIntentUrl(webUrl: string): string {
  const enc = encodeURIComponent(webUrl);
  const path = webUrl.replace(/^https:\/\/www\.tossinvest\.com/i, '');
  return (
    `intent://www.tossinvest.com${path}` +
    `#Intent;scheme=https;package=viva.republica.toss;S.browser_fallback_url=${enc};end`
  );
}

const TOSS_APP_LAUNCH_URLS = ['supertoss://invest', 'supertoss://'] as const;

/**
 * 종목·더보기 — 앱 스킴·Android intent만 시도. https는 폴백에서만 연다.
 * iOS launch 목록에 tossinvest.com을 넣으면 Safari가 먼저 열려 웹으로 보이는 경우가 많다.
 */
export function tossFinanceStockAppLaunchUrls(webUrl: string): string[] {
  if (Platform.OS === 'android') {
    return [tossInvestAndroidIntentUrl(webUrl), ...TOSS_APP_LAUNCH_URLS];
  }
  if (Platform.OS === 'ios') {
    return [...TOSS_APP_LAUNCH_URLS];
  }
  return [webUrl];
}

export function tossFinanceHomeAppLaunchUrls(webUrl: string): string[] {
  return tossFinanceStockAppLaunchUrls(webUrl);
}

/** @deprecated Use tossFinanceStockAppLaunchUrls */
export function tossFinanceAppLaunchUrls(webUrl: string): string[] {
  return tossFinanceStockAppLaunchUrls(webUrl);
}

export async function openTossFinanceStock(symbol: string): Promise<void> {
  const url = tossFinanceStockUrl(symbol);
  if (!url) return;
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: tossFinanceStockAppLaunchUrls(url),
  });
}
