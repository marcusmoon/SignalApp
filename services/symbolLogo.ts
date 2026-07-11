import { isKoreaSymbol } from '@/domain/quotes/rows';

const PARQET_LOGO_BASE = 'https://assets.parqet.com/logos/symbol';

const failedLogoKeys = new Set<string>();

function logoCacheKey(symbol: string, url: string): string {
  return `${symbol.trim().toUpperCase()}|${url}`;
}

function parqetLogoUrl(ticker: string): string {
  return `${PARQET_LOGO_BASE}/${encodeURIComponent(ticker)}`;
}

export function markSymbolLogoFailed(symbol: string, url: string): void {
  failedLogoKeys.add(logoCacheKey(symbol, url));
}

export function isSymbolLogoFailed(symbol: string, url: string): boolean {
  return failedLogoKeys.has(logoCacheKey(symbol, url));
}

/** Parqet 로고 후보 URL — 국장은 .KS → .KQ 순으로 시도 */
export function symbolLogoUrls(symbol: string): string[] {
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym === '—' || sym === 'GLOBAL') return [];

  if (isKoreaSymbol(sym)) {
    return [`${sym}.KS`, `${sym}.KQ`]
      .map((ticker) => parqetLogoUrl(ticker))
      .filter((url) => !isSymbolLogoFailed(sym, url));
  }

  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(sym)) return [];
  const url = parqetLogoUrl(sym);
  return isSymbolLogoFailed(sym, url) ? [] : [url];
}

/** 첫 번째 로고 URL (기존 호출부 호환) */
export function symbolLogoUrl(symbol: string): string | null {
  return symbolLogoUrls(symbol)[0] ?? null;
}
