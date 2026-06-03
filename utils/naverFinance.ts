import { openExternalLink } from '@/utils/openExternalLink';

export function normalizeKrxStockCode(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : '';
}

export function naverFinanceStockUrl(symbol: string): string | null {
  const code = normalizeKrxStockCode(symbol);
  if (!code) return null;
  return `https://m.stock.naver.com/domestic/stock/${encodeURIComponent(code)}/total`;
}

export async function openNaverFinanceStock(symbol: string): Promise<void> {
  const url = naverFinanceStockUrl(symbol);
  if (!url) return;
  await openExternalLink(url, url, {
    preferInAppBrowserOnLinkingFailure: true,
  });
}
