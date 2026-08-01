import type { MessageId } from '@/locales/messages';

/** Yahoo Finance index symbols for home 시세 (Job → market_quotes). */
export type HomeIndexKey =
  | 'sp500'
  | 'nasdaq'
  | 'dow'
  | 'sox'
  | 'kospi'
  | 'nikkei';

export type HomeIndexDef = {
  key: HomeIndexKey;
  /** Stored / API symbol (Yahoo caret ticker). */
  symbol: string;
  /**
   * Parqet logo lookup ticker (지수 caret는 CDN에 없음 → 추종 ETF/대표 종목).
   * 표시 라벨·시세 심볼과는 별개.
   */
  logoSymbol: string;
  labelId: MessageId;
};

/** S&P · 나스닥 · 다우 · 필라 · 코스피 · 니케이 */
export const HOME_INDEX_DEFS: readonly HomeIndexDef[] = [
  { key: 'sp500', symbol: '^GSPC', logoSymbol: 'SPY', labelId: 'homeIndexSp500' },
  { key: 'nasdaq', symbol: '^NDX', logoSymbol: 'QQQ', labelId: 'homeIndexNasdaq' },
  { key: 'dow', symbol: '^DJI', logoSymbol: 'DIA', labelId: 'homeIndexDow' },
  { key: 'sox', symbol: '^SOX', logoSymbol: 'SOXX', labelId: 'homeIndexSox' },
  { key: 'kospi', symbol: '^KS11', logoSymbol: '069500', labelId: 'homeIndexKospi' },
  { key: 'nikkei', symbol: '^N225', logoSymbol: 'EWJ', labelId: 'homeIndexNikkei' },
];

export const HOME_INDEX_SYMBOLS: readonly string[] = HOME_INDEX_DEFS.map((row) => row.symbol);

const BY_SYMBOL = new Map(HOME_INDEX_DEFS.map((row) => [row.symbol.toUpperCase(), row]));

export function homeIndexDefForSymbol(symbol: string): HomeIndexDef | null {
  return BY_SYMBOL.get(String(symbol || '').trim().toUpperCase()) ?? null;
}

export function isHomeIndexSymbol(symbol: string): boolean {
  return homeIndexDefForSymbol(symbol) != null;
}

/** Index levels are unitless — no $ / ₩ prefix. */
export function formatHomeIndexLevel(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
