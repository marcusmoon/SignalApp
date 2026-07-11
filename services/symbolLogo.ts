import { isKoreaSymbol } from '@/domain/quotes/rows';

const failedLogoKeys = new Set<string>();

function logoCacheKey(symbol: string, url: string): string {
  return `${symbol.trim().toUpperCase()}|${url}`;
}

export function markSymbolLogoFailed(symbol: string, url: string): void {
  failedLogoKeys.add(logoCacheKey(symbol, url));
}

export function isSymbolLogoFailed(symbol: string, url: string): boolean {
  return failedLogoKeys.has(logoCacheKey(symbol, url));
}

/** US 상장주 로고 URL — 실패 시 SymbolLogo가 아바타로 fallback */
export function symbolLogoUrl(symbol: string): string | null {
  const sym = symbol.trim().toUpperCase();
  if (!sym || sym === '—' || sym === 'GLOBAL') return null;
  if (isKoreaSymbol(sym)) return null;
  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(sym)) return null;
  const url = `https://assets.parqet.com/logos/symbol/${encodeURIComponent(sym)}`;
  if (isSymbolLogoFailed(sym, url)) return null;
  return url;
}
