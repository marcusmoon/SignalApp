import { buildAppLaunchUrls } from '@/utils/externalLinkRegistry';
import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { nativeAppLaunchUrls } from '@/utils/externalLinkLaunch';

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
 * 종목·더보기 — iOS·iPad 네이티브: supertoss → 유니버설 링크.
 * iOS Safari 웹은 openExternalLink에서 https만 시도(스킴 목록은 무시됨).
 */
export function tossFinanceStockAppLaunchUrls(webUrl: string): string[] | undefined {
  return nativeAppLaunchUrls(webUrl, {
    ios: TOSS_APP_LAUNCH_URLS,
    android: [tossInvestAndroidIntentUrl(webUrl), ...TOSS_APP_LAUNCH_URLS],
  });
}

export function tossFinanceHomeAppLaunchUrls(webUrl: string): string[] | undefined {
  return tossFinanceStockAppLaunchUrls(webUrl);
}

/** @deprecated Use tossFinanceStockAppLaunchUrls */
export function tossFinanceAppLaunchUrls(webUrl: string): string[] | undefined {
  return tossFinanceStockAppLaunchUrls(webUrl);
}

export async function openTossFinanceStock(symbol: string): Promise<void> {
  const url = tossFinanceStockUrl(symbol);
  if (!url) return;
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: buildAppLaunchUrls({ webUrl: url, linkId: 'toss' }),
  });
}
