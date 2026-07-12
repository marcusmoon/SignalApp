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

/** 더보기 숏링크 등 토스증권 홈 — iOS는 tossinvest.com 유니버설 링크 */
export function tossFinanceAppLaunchUrls(webUrl: string): string[] {
  return tossFinanceStockAppLaunchUrls(webUrl);
}

/**
 * 종목 상세 — iOS·iPad는 tossinvest.com 유니버설 링크만 사용.
 * generic `supertoss://`는 앱 홈만 열려 종목 페이지로 가지 않음.
 */
export function tossFinanceStockAppLaunchUrls(webUrl: string): string[] {
  if (Platform.OS === 'ios') {
    return [webUrl];
  }
  if (Platform.OS === 'android') {
    return [tossInvestAndroidIntentUrl(webUrl), webUrl];
  }
  return [webUrl];
}

export async function openTossFinanceStock(symbol: string): Promise<void> {
  const url = tossFinanceStockUrl(symbol);
  if (!url) return;
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: tossFinanceStockAppLaunchUrls(url),
  });
}
