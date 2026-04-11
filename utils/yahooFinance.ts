import { openExternalLink, yahooFinanceAppLaunchUrls } from '@/utils/openExternalLink';

/**
 * Yahoo Finance 웹 종목 페이지 경로.
 * 미국 주식: 티커의 점(.)은 Yahoo에서 하이픈(-)으로 표기되는 경우가 많음 (예: BRK.B → BRK-B).
 * 코인: Yahoo는 보통 BASE-USD 페어를 사용.
 */
export function usTickerToYahooPath(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, '-');
}

export function coinSymbolToYahooPair(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (!s || s === '—') return 'BTC-USD';
  if (/-USD$/i.test(s) || /-USDT$/i.test(s)) return s.toUpperCase();
  return `${s}-USD`;
}

export function yahooFinanceQuoteUrl(symbol: string, mode: 'coin' | 'stock'): string {
  const path = mode === 'coin' ? coinSymbolToYahooPair(symbol) : usTickerToYahooPath(symbol);
  return `https://finance.yahoo.com/quote/${encodeURIComponent(path)}`;
}

/**
 * Yahoo Finance 앱 우선(공통 `openExternalLink`), 실패 시 시스템 브라우저 → 그래도 실패하면 인앱 브라우저.
 */
export async function openYahooFinanceQuote(symbol: string, mode: 'coin' | 'stock'): Promise<void> {
  const url = yahooFinanceQuoteUrl(symbol, mode);
  await openExternalLink(url, yahooFinanceAppLaunchUrls(url), {
    preferInAppBrowserOnLinkingFailure: true,
  });
}

/** 실적·실적콜·트랜스크립트 등 종목별 실적 허브 (티커 페이지의 Earnings 탭) */
export function yahooFinanceEarningsUrl(symbol: string): string {
  const path = usTickerToYahooPath(symbol);
  return `https://finance.yahoo.com/quote/${encodeURIComponent(path)}/earnings`;
}

export async function openYahooFinanceEarnings(symbol: string): Promise<void> {
  const url = yahooFinanceEarningsUrl(symbol);
  await openExternalLink(url, yahooFinanceAppLaunchUrls(url), {
    preferInAppBrowserOnLinkingFailure: true,
  });
}
