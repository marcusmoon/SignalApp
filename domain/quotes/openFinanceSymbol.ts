import { normalizeKrxStockCode, openNaverFinanceStock } from '@/utils/naverFinance';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

/** 국내 주식·ETF 심볼 — 6자리 / `.KS`·`.KQ` / market=kr */
export function isKoreaFinanceSymbol(symbol: string, market?: string | null): boolean {
  const m = String(market || '')
    .trim()
    .toLowerCase();
  if (m === 'kr' || m === 'korea' || m === 'krx') return true;
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return false;
  if (/^\d{6}(\.(KS|KQ))?$/.test(trimmed)) return true;
  return Boolean(normalizeKrxStockCode(trimmed));
}

/** 표시용 티커 — `091160.KS` → `091160` */
export function financeDisplayTicker(symbol: string): string {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return '';
  const krx = normalizeKrxStockCode(trimmed);
  if (krx && (/^\d{6}\.(KS|KQ)$/.test(trimmed) || /^\d{6}$/.test(trimmed))) return krx;
  return trimmed;
}

/**
 * 종목·ETF·코인 등 시세 외부 링크 — 국내 Naver, 해외 Yahoo.
 * 브리핑·다이제스트 entity 탭·히트맵 칩 등 공용.
 */
export function openFinanceSymbol(symbol: string, market?: string | null): void {
  const trimmed = String(symbol || '').trim();
  if (!trimmed || trimmed === '—') return;
  if (isKoreaFinanceSymbol(trimmed, market)) {
    void openNaverFinanceStock(trimmed);
    return;
  }
  const yahooHint = /^\d{6}\.(KS|KQ)$/i.test(trimmed) ? trimmed.toUpperCase() : null;
  void openYahooFinanceQuote(trimmed, 'stock', { yahooSymbol: yahooHint });
}
