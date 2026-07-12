import type { ComponentProps } from 'react';
import type FontAwesome from '@expo/vector-icons/FontAwesome';

import type { MessageId } from '@/locales/messages';
import { googleFinanceQuoteUrl } from '@/utils/googleFinance';
import {
  naverFinanceStockAppLaunchUrls,
  naverFinanceStockUrl,
  naverFinanceWorldStockUrl,
} from '@/utils/naverFinance';
import { tossFinanceStockAppLaunchUrls, tossFinanceStockUrl } from '@/utils/tossFinance';
import { yahooFinanceQuoteAppLaunchUrls } from '@/utils/yahooFinance';
import { yahooFinanceEarningsUrl, yahooFinanceQuoteUrl } from '@/utils/yahooFinance';

export type SymbolExternalLink = {
  id: string;
  labelKey: MessageId;
  url: string;
  appLaunchUrls?: string[];
  openInAppBrowser?: boolean;
  icon?: ComponentProps<typeof FontAwesome>['name'];
  iconMark?: string;
};

export type SymbolExternalLinkHint = {
  yahooSymbol?: string | null;
};

/** 해외 종목 — 유용도 순 */
const OVERSEAS_LINK_ORDER = [
  'naver',
  'toss',
  'yahoo',
  'yahoo-earnings',
  'sec',
  'google-finance',
  'tradingview',
] as const;

/** 국내 종목 — 유용도 순 */
const DOMESTIC_LINK_ORDER = [
  'naver',
  'toss',
  'google-finance',
  'naver-news',
  'naver-dart',
  'dart',
] as const;

function isKoreaSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

function normalizeKrxCode(symbol: string): string | null {
  const digits = String(symbol || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

function usTickerPath(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\./g, '-');
}

function sortByOrder(links: SymbolExternalLink[], order: readonly string[]): SymbolExternalLink[] {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...links].sort(
    (a, b) => (rank.get(a.id) ?? order.length) - (rank.get(b.id) ?? order.length),
  );
}

export function buildSymbolExternalLinks(
  symbol: string,
  hint?: SymbolExternalLinkHint,
): SymbolExternalLink[] {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return [];

  if (isKoreaSymbol(trimmed)) {
    const code = normalizeKrxCode(trimmed);
    if (!code) return [];

    const links: SymbolExternalLink[] = [];
    const naverUrl = naverFinanceStockUrl(code);
    if (naverUrl) {
      links.push({
        id: 'naver',
        labelKey: 'quotesNaverShort',
        url: naverUrl,
        appLaunchUrls: naverFinanceStockAppLaunchUrls(naverUrl),
        iconMark: 'Naver',
      });
    }
    const tossUrl = tossFinanceStockUrl(code);
    if (tossUrl) {
      links.push({
        id: 'toss',
        labelKey: 'moreRefTitleTossSecurities',
        url: tossUrl,
        appLaunchUrls: tossFinanceStockAppLaunchUrls(tossUrl),
        iconMark: 'Toss',
      });
    }
    links.push(
      {
        id: 'google-finance',
        labelKey: 'symbolDetailLinkGoogleFinance',
        url: googleFinanceQuoteUrl(code, hint),
        openInAppBrowser: true,
        icon: 'google',
      },
      {
        id: 'naver-news',
        labelKey: 'symbolDetailLinkNaverNews',
        url: `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/news`,
        openInAppBrowser: true,
        icon: 'newspaper-o',
      },
      {
        id: 'naver-dart',
        labelKey: 'symbolDetailLinkDart',
        url: `https://finance.naver.com/item/dart.naver?code=${encodeURIComponent(code)}`,
        openInAppBrowser: true,
        icon: 'file-text-o',
      },
      {
        id: 'dart',
        labelKey: 'symbolDetailLinkDartOfficial',
        url: 'https://m.dart.fss.or.kr',
        openInAppBrowser: true,
        iconMark: 'DART',
      },
    );
    return sortByOrder(links, DOMESTIC_LINK_ORDER);
  }

  const yahooQuote = yahooFinanceQuoteUrl(trimmed, 'stock', hint);
  const yahooEarnings = yahooFinanceEarningsUrl(trimmed, hint);
  const tickerPath = usTickerPath(trimmed);
  const naverUrl = naverFinanceWorldStockUrl(trimmed);
  const tossUrl = tossFinanceStockUrl(trimmed);

  const links: SymbolExternalLink[] = [];

  if (naverUrl) {
    links.push({
      id: 'naver',
      labelKey: 'quotesNaverShort',
      url: naverUrl,
      appLaunchUrls: naverFinanceStockAppLaunchUrls(naverUrl),
      iconMark: 'Naver',
    });
  }

  if (tossUrl) {
    links.push({
      id: 'toss',
      labelKey: 'moreRefTitleTossSecurities',
      url: tossUrl,
      appLaunchUrls: tossFinanceStockAppLaunchUrls(tossUrl),
      iconMark: 'Toss',
    });
  }

  links.push(
    {
      id: 'yahoo',
      labelKey: 'quotesYahooShort',
      url: yahooQuote,
      appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(yahooQuote),
      icon: 'yahoo',
    },
    {
      id: 'yahoo-earnings',
      labelKey: 'symbolDetailLinkEarnings',
      url: yahooEarnings,
      appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(yahooEarnings),
      icon: 'bar-chart',
    },
    {
      id: 'sec',
      labelKey: 'symbolDetailLinkSec',
      url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(trimmed)}`,
      openInAppBrowser: true,
      iconMark: 'SEC',
    },
    {
      id: 'google-finance',
      labelKey: 'symbolDetailLinkGoogleFinance',
      url: googleFinanceQuoteUrl(trimmed, hint),
      openInAppBrowser: true,
      icon: 'google',
    },
    {
      id: 'tradingview',
      labelKey: 'symbolDetailLinkTradingView',
      url: `https://www.tradingview.com/symbols/${encodeURIComponent(tickerPath)}/`,
      openInAppBrowser: true,
      iconMark: 'TV',
    },
  );

  return sortByOrder(links, OVERSEAS_LINK_ORDER);
}
