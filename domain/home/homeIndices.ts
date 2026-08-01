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
  labelId: MessageId;
};

/** S&P · 나스닥 · 다우 · 필라 · 코스피 · 니케이 */
export const HOME_INDEX_DEFS: readonly HomeIndexDef[] = [
  { key: 'sp500', symbol: '^GSPC', labelId: 'homeIndexSp500' },
  { key: 'nasdaq', symbol: '^NDX', labelId: 'homeIndexNasdaq' },
  { key: 'dow', symbol: '^DJI', labelId: 'homeIndexDow' },
  { key: 'sox', symbol: '^SOX', labelId: 'homeIndexSox' },
  { key: 'kospi', symbol: '^KS11', labelId: 'homeIndexKospi' },
  { key: 'nikkei', symbol: '^N225', labelId: 'homeIndexNikkei' },
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
