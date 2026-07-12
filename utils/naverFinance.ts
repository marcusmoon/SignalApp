import { Platform } from 'react-native';

import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';

export function normalizeKrxStockCode(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : '';
}

/** 네이버 해외주식 URL 접미사 — NASDAQ `.O`, NYSE `.N` */
export type NaverWorldStockExchange = 'NASDAQ' | 'NYSE';

function naverWorldStockSuffix(exchange: NaverWorldStockExchange = 'NASDAQ'): '.O' | '.N' {
  return exchange === 'NYSE' ? '.N' : '.O';
}

function usTickerToNaverPath(symbol: string): string | null {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(trimmed)) return null;
  return trimmed.replace(/\./g, '-');
}

export function naverFinanceStockUrl(symbol: string): string | null {
  const code = normalizeKrxStockCode(symbol);
  if (!code) return null;
  return `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/total`;
}

/** 네이버 해외주식 종목 상세 — 거래소 미상 시 NASDAQ(`.O`) 기본 */
export function naverFinanceWorldStockUrl(
  symbol: string,
  options?: { exchange?: NaverWorldStockExchange },
): string | null {
  const path = usTickerToNaverPath(symbol);
  if (!path) return null;
  const suffix = naverWorldStockSuffix(options?.exchange);
  return `https://m.stock.naver.com/worldstock/stock/${encodeURIComponent(`${path}${suffix}`)}/total`;
}

/** 네이버 앱 인앱 브라우저로 증권 URL 열기 — plain `naversearchapp://`는 홈만 열림 */
export function naverFinanceInAppBrowserScheme(webUrl: string): string {
  const encoded = encodeURIComponent(webUrl);
  return `naversearchapp://inappbrowser?url=${encoded}&target=new&version=6`;
}

/** 네이버 앱 중계 URL — iOS·iPad에서 커스텀 스킴이 막힐 때 보조 */
export function naverFinanceRelayInAppBrowserUrl(webUrl: string): string {
  const encoded = encodeURIComponent(webUrl);
  return `http://naverapp.naver.com/inappbrowser/?url=${encoded}&target=new&version=6`;
}

export function naverFinanceAndroidIntentUrl(webUrl: string): string {
  const encoded = encodeURIComponent(webUrl);
  return (
    `intent://inappbrowser?url=${encoded}&target=new&version=6` +
    `#Intent;scheme=naversearchapp;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;package=com.nhn.android.search;end;`
  );
}

/** 종목·더보기 — 네이버 앱 inappbrowser·중계 URL만 시도, https는 폴백에서 */
export function naverFinanceStockAppLaunchUrls(webUrl: string): string[] {
  const inApp = naverFinanceInAppBrowserScheme(webUrl);
  if (Platform.OS === 'android') {
    return [naverFinanceAndroidIntentUrl(webUrl), inApp];
  }
  return [inApp, naverFinanceRelayInAppBrowserUrl(webUrl)];
}

/** @deprecated Use naverFinanceStockAppLaunchUrls for stock pages */
export function naverFinanceAppLaunchUrls(webUrl: string): string[] {
  return naverFinanceStockAppLaunchUrls(webUrl);
}

export function naverFinanceQuoteUrl(
  symbol: string,
  options?: { exchange?: NaverWorldStockExchange },
): string | null {
  const trimmed = String(symbol || '').trim();
  if (!trimmed) return null;
  if (normalizeKrxStockCode(trimmed)) return naverFinanceStockUrl(trimmed);
  return naverFinanceWorldStockUrl(trimmed, options);
}

export async function openNaverFinanceStock(symbol: string): Promise<void> {
  const url = naverFinanceQuoteUrl(symbol);
  if (!url) return;
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: naverFinanceStockAppLaunchUrls(url),
  });
}
