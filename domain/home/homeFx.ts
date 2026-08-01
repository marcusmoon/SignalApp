import type { MessageId } from '@/locales/messages';

/** Yahoo FX symbols for home 환율 (Job → market_quotes). */
export type HomeFxKey = 'usdKrw' | 'jpyKrw' | 'cnyKrw';

export type HomeFxDef = {
  key: HomeFxKey;
  /** Stored / API symbol (Yahoo FX pair). */
  symbol: string;
  /** Avatar fallback glyph when the flag image fails. */
  logoSymbol: string;
  /** ISO 3166-1 alpha-2 for flag CDN (US / JP / CN). */
  flagCountryCode: 'us' | 'jp' | 'cn';
  labelId: MessageId;
  /**
   * Multiply Yahoo unit rate for display (JPY is shown per 100 yen).
   * Change % is unchanged — scale cancels out.
   */
  displayScale?: number;
  /** Wide/PC only (compact phone keeps USD + JPY). */
  wideOnly?: boolean;
};

/** Flagpedia / flagcdn — fixed-width PNG. */
const FX_FLAG_CDN = 'https://flagcdn.com/w80';

/** 달러 · JPY · (와이드) 위안. JPY는 한국식 100엔 기준 표시. */
export const HOME_FX_DEFS: readonly HomeFxDef[] = [
  {
    key: 'usdKrw',
    symbol: 'USDKRW=X',
    logoSymbol: 'USD',
    flagCountryCode: 'us',
    labelId: 'homeFxUsd',
  },
  {
    key: 'jpyKrw',
    symbol: 'JPYKRW=X',
    logoSymbol: 'JPY',
    flagCountryCode: 'jp',
    labelId: 'homeFxJpy',
    displayScale: 100,
  },
  {
    key: 'cnyKrw',
    symbol: 'CNYKRW=X',
    logoSymbol: 'CNY',
    flagCountryCode: 'cn',
    labelId: 'homeFxCny',
    wideOnly: true,
  },
];

export const HOME_FX_SYMBOLS: readonly string[] = HOME_FX_DEFS.map((row) => row.symbol);

const BY_SYMBOL = new Map(HOME_FX_DEFS.map((row) => [row.symbol.toUpperCase(), row]));

export function homeFxDefForSymbol(symbol: string): HomeFxDef | null {
  return BY_SYMBOL.get(String(symbol || '').trim().toUpperCase()) ?? null;
}

export function isHomeFxSymbol(symbol: string): boolean {
  return homeFxDefForSymbol(symbol) != null;
}

/** Compact: USD+JPY · wide/PC: +CNY */
export function homeFxDefsForLayout(useTwoPane: boolean): readonly HomeFxDef[] {
  if (useTwoPane) return HOME_FX_DEFS;
  return HOME_FX_DEFS.filter((row) => !row.wideOnly);
}

export function homeFxFlagImageUrl(def: HomeFxDef): string {
  return `${FX_FLAG_CDN}/${def.flagCountryCode}.png`;
}

/** Scaled unit rate for UI (e.g. JPY × 100). */
export function homeFxDisplayRate(value: unknown, def?: HomeFxDef | null): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const scale = def?.displayScale;
  const scaled = scale && Number.isFinite(scale) && scale > 0 ? n * scale : n;
  return scaled;
}

/** FX rates — no currency prefix; 2 decimal places. */
export function formatHomeFxRate(value: unknown, def?: HomeFxDef | null): string {
  const n = homeFxDisplayRate(value, def);
  if (n == null) return '—';
  return Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
