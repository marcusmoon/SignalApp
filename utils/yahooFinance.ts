import { Platform } from 'react-native';

import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { nativeAppLaunchUrls } from '@/utils/externalLinkLaunch';
import { canAttemptNativeAppLaunch, usesIosAppLinkPolicy } from '@/utils/externalLinkPlatform';
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
 * iOS·iPad 네이티브 — Linking.openURL(https)는 Safari로만 열리므로 커스텀 스킴만 시도.
 * 경로가 있으면 yfinance/yahoo 스킴에 붙여 본다(미지원 시 앱 홈으로라도 이동).
 */
export function yahooFinanceIosAppLaunchUrls(webUrl: string): readonly string[] {
  const urls: string[] = [];
  try {
    const parsed = new URL(webUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'finance.yahoo.com') {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      if (path.length > 1) {
        const trimmed = path.replace(/^\//, '');
        urls.push(`yfinance:/${trimmed}`);
        urls.push(`yfinance://${parsed.host}${path}`);
        urls.push(`yahoo:/${trimmed}`);
        urls.push(`yahoo://${parsed.host}${path}`);
      }
    }
  } catch {
    /* ignore */
  }
  urls.push('yfinance://', 'yahoo://');
  return urls;
}

/**
 * 종목 상세·더보기 — iOS·iPad 네이티브는 커스텀 스킴, Android는 intent.
 */
export function yahooFinanceQuoteAppLaunchUrls(webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;
  if (usesIosAppLinkPolicy()) {
    return nativeAppLaunchUrls(webUrl, {
      ios: yahooFinanceIosAppLaunchUrls(webUrl),
      iosAppendUniversalLink: false,
    });
  }
  if (Platform.OS === 'android') {
    return [yahooFinanceAndroidIntentUrl(webUrl), webUrl];
  }
  return undefined;
}

export function yahooFinanceHomeAppLaunchUrls(webUrl: string): string[] | undefined {
  return yahooFinanceQuoteAppLaunchUrls(webUrl);
}

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
