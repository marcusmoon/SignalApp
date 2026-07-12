import { openExternalLink } from '@/utils/openExternalLink';

const TOSS_INVEST_APP_LAUNCH_URLS = [
  'supertoss://invest',
  'supertoss://',
  'supertoss://home',
] as const;

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

export function tossFinanceAppLaunchUrls(webUrl: string): string[] {
  return [...TOSS_INVEST_APP_LAUNCH_URLS, webUrl];
}

export async function openTossFinanceStock(symbol: string): Promise<void> {
  const url = tossFinanceStockUrl(symbol);
  if (!url) return;
  await openExternalLink(url, tossFinanceAppLaunchUrls(url), {
    preferInAppBrowserOnLinkingFailure: true,
  });
}
