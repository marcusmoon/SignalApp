import { openConfiguredExternalLink } from '@/utils/externalLinkOpen';
import { orderAppLaunchUrlsForPlatform } from '@/utils/openExternalLink';

const NAVER_APP_LAUNCH_URLS = ['naversearchapp://'] as const;

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

export function naverFinanceAppLaunchUrls(webUrl: string): string[] {
  return orderAppLaunchUrlsForPlatform([...NAVER_APP_LAUNCH_URLS, webUrl], webUrl);
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
    appLaunchUrls: naverFinanceAppLaunchUrls(url),
  });
}
