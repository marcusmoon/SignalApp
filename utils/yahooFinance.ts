import { Platform } from 'react-native';

import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import {
  yahooFinanceAndroidIntentUrl,
} from '@/utils/openExternalLink';

/**
 * Yahoo Finance 웹 종목 페이지 경로.
 * 미국 주식: 티커의 점(.)은 Yahoo에서 하이픈(-)으로 표기되는 경우가 많음 (예: BRK.B → BRK-B).
 * 코인: Yahoo는 보통 BASE-USD 페어를 사용.
 */
export function usTickerToYahooPath(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\./g, '-');
}

/** 시세 payload의 yahooSymbol(예: 005930.KS) 우선, 없으면 티커에서 추론 */
export function resolveYahooFinanceSymbol(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): string {
  const fromQuote = String(hint?.yahooSymbol || '').trim();
  if (fromQuote) return fromQuote;

  const trimmed = String(symbol || '').trim().toUpperCase();
  if (/^\d{6}$/.test(trimmed)) return `${trimmed}.KS`;
  return usTickerToYahooPath(trimmed);
}

export function coinSymbolToYahooPair(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (!s || s === '—') return 'BTC-USD';
  if (/-USD$/i.test(s) || /-USDT$/i.test(s)) return s.toUpperCase();
  return `${s}-USD`;
}

export function yahooFinanceQuoteUrl(
  symbol: string,
  mode: 'coin' | 'stock',
  hint?: { yahooSymbol?: string | null },
): string {
  const path =
    mode === 'coin'
      ? coinSymbolToYahooPair(symbol)
      : resolveYahooFinanceSymbol(symbol, hint);
  return `https://finance.yahoo.com/quote/${encodeURIComponent(path)}`;
}

/**
 * 종목 상세·리스트 — iOS·iPad는 finance.yahoo.com 유니버설 링크만 사용.
 * generic `yfinance://`는 앱 홈만 열려 해당 종목으로 가지 않음.
 */
export function yahooFinanceQuoteAppLaunchUrls(webUrl: string): string[] {
  if (Platform.OS === 'ios') return [webUrl];
  if (Platform.OS === 'android') {
    return [yahooFinanceAndroidIntentUrl(webUrl), webUrl];
  }
  return [webUrl];
}

/** 더보기 Yahoo — 종목 상세와 동일(유니버설 링크로 앱 연동) */
export function yahooFinanceHomeAppLaunchUrls(webUrl: string): string[] {
  return yahooFinanceQuoteAppLaunchUrls(webUrl);
}

/**
 * Yahoo Finance 앱 우선(공통 `openExternalLink`), 실패 시 시스템 브라우저 → 그래도 실패하면 인앱 브라우저.
 */
export async function openYahooFinanceQuote(
  symbol: string,
  mode: 'coin' | 'stock',
  hint?: { yahooSymbol?: string | null },
): Promise<void> {
  const url = yahooFinanceQuoteUrl(symbol, mode, hint);
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(url),
  });
}

/** 실적 캘린더 — `/quote/.../earnings` 경로는 Yahoo에서 더 이상 유효하지 않음 */
export function yahooFinanceEarningsUrl(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): string {
  const path = resolveYahooFinanceSymbol(symbol, hint).replace(/\.(KS|KQ)$/i, '');
  return `https://finance.yahoo.com/calendar/earnings?symbol=${encodeURIComponent(path)}`;
}

export async function openYahooFinanceEarnings(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): Promise<void> {
  const url = yahooFinanceEarningsUrl(symbol, hint);
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(url),
  });
}
