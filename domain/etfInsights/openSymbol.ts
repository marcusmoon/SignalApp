import { normalizeKrxStockCode, openNaverFinanceStock } from '@/utils/naverFinance';
import { openYahooFinanceQuote } from '@/utils/yahooFinance';

/** 국내 ETF·주식 심볼 — 6자리 / `.KS`·`.KQ` / market=kr */
export function isKoreaEtfSymbol(symbol: string, market?: string | null): boolean {
  const m = String(market || '')
    .trim()
    .toLowerCase();
  if (m === 'kr' || m === 'korea' || m === 'krx') return true;
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return false;
  if (/^\d{6}(\.(KS|KQ))?$/.test(trimmed)) return true;
  return Boolean(normalizeKrxStockCode(trimmed));
}

/** 히트맵·테마 셀 표시용 — `091160.KS` → `091160` */
export function etfInsightDisplayTicker(symbol: string): string {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return '';
  const krx = normalizeKrxStockCode(trimmed);
  if (krx && (/^\d{6}\.(KS|KQ)$/.test(trimmed) || /^\d{6}$/.test(trimmed))) return krx;
  return trimmed;
}

/**
 * ETF 인사이트 종목 외부 링크 — 국내 Naver, 해외 Yahoo (시세 탭과 동일).
 */
export function openEtfInsightSymbol(symbol: string, market?: string | null): void {
  const trimmed = String(symbol || '').trim();
  if (!trimmed || trimmed === '—') return;
  if (isKoreaEtfSymbol(trimmed, market)) {
    void openNaverFinanceStock(trimmed);
    return;
  }
  const yahooHint = /^\d{6}\.(KS|KQ)$/i.test(trimmed) ? trimmed.toUpperCase() : null;
  void openYahooFinanceQuote(trimmed, 'stock', { yahooSymbol: yahooHint });
}
