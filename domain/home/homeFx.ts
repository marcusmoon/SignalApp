import type { MessageId } from '@/locales/messages';

/** Yahoo FX symbols for home 환율 (Job → market_quotes). */
export type HomeFxKey = 'usdKrw' | 'jpyKrw';

export type HomeFxDef = {
  key: HomeFxKey;
  /** Stored / API symbol (Yahoo FX pair). */
  symbol: string;
  /**
   * Parqet/avatar lookup key. FX `=X` pairs are not on CDN —
   * use short currency codes for letter avatars.
   */
  logoSymbol: string;
  labelId: MessageId;
};

/** 달러 · 엔 (원 대비) */
export const HOME_FX_DEFS: readonly HomeFxDef[] = [
  { key: 'usdKrw', symbol: 'USDKRW=X', logoSymbol: 'USD', labelId: 'homeFxUsd' },
  { key: 'jpyKrw', symbol: 'JPYKRW=X', logoSymbol: 'JPY', labelId: 'homeFxJpy' },
];

export const HOME_FX_SYMBOLS: readonly string[] = HOME_FX_DEFS.map((row) => row.symbol);

const BY_SYMBOL = new Map(HOME_FX_DEFS.map((row) => [row.symbol.toUpperCase(), row]));

export function homeFxDefForSymbol(symbol: string): HomeFxDef | null {
  return BY_SYMBOL.get(String(symbol || '').trim().toUpperCase()) ?? null;
}

export function isHomeFxSymbol(symbol: string): boolean {
  return homeFxDefForSymbol(symbol) != null;
}

/** FX rates — no currency prefix; 2 decimal places. */
export function formatHomeFxRate(value: unknown): string {
  if (value == null || value === '') return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
