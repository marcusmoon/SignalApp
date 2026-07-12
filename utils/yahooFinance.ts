import { Platform } from 'react-native';

import { buildAppLaunchUrls } from '@/utils/externalLinkRegistry';
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

/** iOS 커스텀 스킴 순서 — host 포함 URL 우선, `?`가 있는 짧은 path 스킴은 제외 */
function orderYahooIosLaunchUrls(urls: readonly string[]): string[] {
  const hostQualified: string[] = [];
  const pathShort: string[] = [];
  const bare: string[] = [];

  for (const url of urls) {
    if (url === 'yfinance://' || url === 'yahoo://') {
      bare.push(url);
      continue;
    }
    if (/^[a-z]+:\/\/finance\.yahoo\.com/i.test(url)) {
      hostQualified.push(url);
      continue;
    }
    if (url.includes('?')) {
      continue;
    }
    pathShort.push(url);
  }

  return [...hostQualified, ...pathShort, ...bare];
}

function yahooSymbolFromEarningsCalendarUrl(webUrl: string): string | null {
  try {
    const parsed = new URL(webUrl);
    if (!parsed.pathname.toLowerCase().includes('/calendar/earnings')) return null;
    const symbol = parsed.searchParams.get('symbol')?.trim();
    return symbol || null;
  } catch {
    return null;
  }
}

/**
 * iOS·iPad 네이티브 — 타 앱에서 Linking.openURL(https)만 쓰면 Safari로 빠지는 경우가 많아
 * 커스텀 스킴을 먼저 시도하고, 이어서 https 유니버설 링크를 시도한다.
 */
export function yahooFinanceIosAppLaunchUrls(webUrl: string): readonly string[] {
  const urls: string[] = [];
  try {
    const parsed = new URL(webUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'finance.yahoo.com') {
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      const trimmed = path.replace(/^\//, '');
      if (trimmed.length > 0) {
        urls.push(`yfinance:/${trimmed}`);
        urls.push(`yfinance://${parsed.host}${path}`);
        urls.push(`yahoo:/${trimmed}`);
        urls.push(`yahoo://${parsed.host}${path}`);
      } else {
        urls.push(`yfinance://${parsed.host}/`);
        urls.push(`yfinance://${parsed.host}`);
        urls.push(`yahoo://${parsed.host}/`);
        urls.push(`yahoo://${parsed.host}`);
      }
    }
  } catch {
    /* ignore */
  }
  urls.push('yfinance://', 'yahoo://');
  return orderYahooIosLaunchUrls(urls);
}

/**
 * 종목 상세·더보기 — iOS·iPad 네이티브는 커스텀 스킴, Android는 intent.
 */
export function yahooFinanceQuoteAppLaunchUrls(webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;
  if (usesIosAppLinkPolicy()) {
    return nativeAppLaunchUrls(webUrl, {
      ios: yahooFinanceIosAppLaunchUrls(webUrl),
      iosAppendUniversalLink: true,
    });
  }
  if (Platform.OS === 'android') {
    return [yahooFinanceAndroidIntentUrl(webUrl), webUrl];
  }
  return undefined;
}

/**
 * Yahoo Finance — webUrl 경로에 따라 launch 규칙 자동 선택 (홈·quote·earnings).
 * 신규 Yahoo 링크는 webUrl만 맞추면 되고, earnings는 `/calendar/earnings` 경로로 판별한다.
 */
export function yahooFinanceAppLaunchUrls(webUrl: string): string[] | undefined {
  if (yahooSymbolFromEarningsCalendarUrl(webUrl)) {
    return yahooFinanceEarningsAppLaunchUrls(webUrl);
  }
  return yahooFinanceQuoteAppLaunchUrls(webUrl);
}

export function yahooFinanceHomeAppLaunchUrls(webUrl: string): string[] | undefined {
  return yahooFinanceAppLaunchUrls(webUrl);
}

/** 실적 캘린더 — 쿼리 스트링 URL은 host 스킴 우선, 앱 미지원 시 quote 심볼로 폴백 */
export function yahooFinanceEarningsAppLaunchUrls(webUrl: string): string[] | undefined {
  if (!canAttemptNativeAppLaunch()) return undefined;

  if (usesIosAppLinkPolicy()) {
    const calendarIos = yahooFinanceIosAppLaunchUrls(webUrl);
    const symbol = yahooSymbolFromEarningsCalendarUrl(webUrl);
    let ios = calendarIos;
    if (symbol) {
      const quoteUrl = yahooFinanceQuoteUrl(symbol, 'stock');
      const quoteIos = yahooFinanceIosAppLaunchUrls(quoteUrl).filter(
        (url) => url !== 'yfinance://' && url !== 'yahoo://',
      );
      const hostCalendar = calendarIos.filter((url) => /^[a-z]+:\/\/finance\.yahoo\.com/i.test(url));
      const restCalendar = calendarIos.filter((url) => !/^[a-z]+:\/\/finance\.yahoo\.com/i.test(url));
      ios = [...hostCalendar, ...quoteIos, ...restCalendar];
    }
    return nativeAppLaunchUrls(webUrl, {
      ios,
      iosAppendUniversalLink: true,
    });
  }

  if (Platform.OS === 'android') {
    return [yahooFinanceAndroidIntentUrl(webUrl), webUrl];
  }

  return undefined;
}

export async function openYahooFinanceQuote(
  symbol: string,
  mode: 'coin' | 'stock',
  hint?: { yahooSymbol?: string | null },
): Promise<void> {
  const url = yahooFinanceQuoteUrl(symbol, mode, hint);
  await openConfiguredExternalLink({
    webUrl: url,
    appLaunchUrls: buildAppLaunchUrls({ webUrl: url, linkId: 'yahoo' }),
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
    appLaunchUrls: buildAppLaunchUrls({ webUrl: url, linkId: 'yahoo-earnings' }),
  });
}
