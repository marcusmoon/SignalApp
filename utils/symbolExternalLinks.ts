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
};

export type SymbolExternalLinkHint = {
  yahooSymbol?: string | null;
};

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

export function buildSymbolExternalLinks(
  symbol: string,
  hint?: SymbolExternalLinkHint,
): SymbolExternalLink[] {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return [];

  if (isKoreaSymbol(trimmed)) {
    const code = normalizeKrxCode(trimmed);
    if (!code) return [];
    const naverUrl = naverFinanceStockUrl(code);
    const links: SymbolExternalLink[] = [];
    if (naverUrl) {
      links.push({
        id: 'naver',
        labelKey: 'quotesNaverShort',
        url: naverUrl,
        appLaunchUrls: naverFinanceStockAppLaunchUrls(naverUrl),
      });
    }
    const tossUrl = tossFinanceStockUrl(code);
    if (tossUrl) {
      links.push({
        id: 'toss',
        labelKey: 'moreRefTitleTossSecurities',
        url: tossUrl,
        appLaunchUrls: tossFinanceStockAppLaunchUrls(tossUrl),
      });
    }
    links.push(
      {
        id: 'google-finance',
        labelKey: 'symbolDetailLinkGoogleFinance',
        url: googleFinanceQuoteUrl(code, hint),
        openInAppBrowser: true,
      },
      {
        id: 'naver-news',
        labelKey: 'symbolDetailLinkNaverNews',
        url: `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/news`,
        openInAppBrowser: true,
      },
      {
        id: 'naver-dart',
        labelKey: 'symbolDetailLinkDart',
        url: `https://finance.naver.com/item/dart.naver?code=${encodeURIComponent(code)}`,
        openInAppBrowser: true,
      },
      {
        id: 'dart',
        labelKey: 'symbolDetailLinkDartOfficial',
        url: 'https://m.dart.fss.or.kr',
        openInAppBrowser: true,
      },
    );
    return links;
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
    });
  }

  if (tossUrl) {
    links.push({
      id: 'toss',
      labelKey: 'moreRefTitleTossSecurities',
      url: tossUrl,
      appLaunchUrls: tossFinanceStockAppLaunchUrls(tossUrl),
    });
  }

  links.push(
    {
      id: 'yahoo',
      labelKey: 'quotesYahooShort',
      url: yahooQuote,
      appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(yahooQuote),
    },
    {
      id: 'yahoo-earnings',
      labelKey: 'symbolDetailLinkEarnings',
      url: yahooEarnings,
      appLaunchUrls: yahooFinanceQuoteAppLaunchUrls(yahooEarnings),
    },
  );

  links.push(
    {
      id: 'sec',
      labelKey: 'symbolDetailLinkSec',
      url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(trimmed)}`,
      openInAppBrowser: true,
    },
    {
      id: 'google-finance',
      labelKey: 'symbolDetailLinkGoogleFinance',
      url: googleFinanceQuoteUrl(trimmed, hint),
      openInAppBrowser: true,
    },
    {
      id: 'tradingview',
      labelKey: 'symbolDetailLinkTradingView',
      url: `https://www.tradingview.com/symbols/${encodeURIComponent(tickerPath)}/`,
      openInAppBrowser: true,
    },
  );

  return links;
}
