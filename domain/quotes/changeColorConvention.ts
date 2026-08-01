import type { ThemeColorScheme } from '@/constants/theme';

/** 시세·가격 변동률 표시 색 규칙 */
export type QuotesChangeColorConvention = 'korea' | 'us';

export const QUOTES_CHANGE_COLOR_CONVENTION_ORDER: readonly QuotesChangeColorConvention[] = [
  'korea',
  'us',
];

export const QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT: QuotesChangeColorConvention = 'korea';

export type QuoteChangeColors = {
  up: string;
  down: string;
};

const PALETTE: Record<
  QuotesChangeColorConvention,
  Record<ThemeColorScheme, QuoteChangeColors>
> = {
  korea: {
    light: { up: '#F04452', down: '#3182F6' },
    dark: { up: '#FF6B7A', down: '#4D9FFF' },
  },
  us: {
    light: { up: '#03B26C', down: '#F04452' },
    dark: { up: '#34D399', down: '#FF6B7A' },
  },
};

export function normalizeQuotesChangeColorConvention(raw: unknown): QuotesChangeColorConvention {
  return raw === 'us' ? 'us' : QUOTES_CHANGE_COLOR_CONVENTION_DEFAULT;
}

export function getQuoteChangeColors(
  convention: QuotesChangeColorConvention,
  scheme: ThemeColorScheme,
): QuoteChangeColors {
  return PALETTE[convention][scheme];
}

function finiteChangeNumber(value: unknown): number | null {
  // Number(null) === 0 — treat null/'' as missing so coin % can drive color.
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isQuoteChangePositive(q: {
  change?: unknown;
  changePercent?: unknown;
}): boolean {
  const d = finiteChangeNumber(q.change);
  const dp = finiteChangeNumber(q.changePercent);
  // Prefer non-zero absolute change; if change is 0/missing, use percent
  // (CoinGecko sometimes omits change24h while changePercent24h is set).
  if (d != null && !(d === 0 && dp != null && dp !== 0)) return d >= 0;
  if (dp != null) return dp >= 0;
  return true;
}
