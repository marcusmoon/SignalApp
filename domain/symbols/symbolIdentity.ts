export type ResolvedSymbolIdentity = {
  symbol: string;
  displaySymbol: string;
  displayName: string | null;
  imageUrl: string | null;
  market: 'kr' | 'global' | 'unknown';
};

/** Canonical display key. `005930.KS` -> `005930`, `BRK.B.US` -> `BRK.B`. */
export function normalizeDisplaySymbol(symbol: string): string {
  const raw = String(symbol || '').trim().toUpperCase();
  if (!raw) return '';
  const kr = raw.match(/^(\d{6})\.(KS|KQ)$/);
  if (kr) return kr[1];
  const exchange = raw.match(/^([A-Z][A-Z0-9.\-]{0,11})\.(US|NYSE|NASDAQ|AMEX|NMS|NYQ)$/);
  if (exchange) return exchange[1];
  return raw;
}

export function isKoreanDisplaySymbol(symbol: string): boolean {
  return /^\d{6}$/.test(normalizeDisplaySymbol(symbol));
}

/**
 * List/tile UI company label. KRX codes may show an issuer name; global letter
 * tickers stay ticker-only (no English/local company name under the symbol).
 */
export function companyNameForSymbolUi(
  name: string | null | undefined,
  symbol: string,
): string | null {
  if (!isKoreanDisplaySymbol(symbol)) return null;
  const label = String(name || '').trim();
  return isUsableCompanyDisplayName(label, symbol) ? label : null;
}

export function isTickerLikeDisplayName(name: string): boolean {
  const text = String(name || '').trim().toUpperCase();
  if (!text) return false;
  return /^\d{6}(\.(KS|KQ))?$/.test(text);
}

export function isUsableCompanyDisplayName(name: string, symbol: string): boolean {
  const label = String(name || '').trim();
  const displaySymbol = normalizeDisplaySymbol(symbol);
  if (!label || !displaySymbol) return false;
  if (label.toUpperCase() === displaySymbol) return false;
  if (normalizeDisplaySymbol(label) === displaySymbol) return false;
  if (isTickerLikeDisplayName(label)) return false;
  return true;
}

export function resolveSymbolIdentity(input: {
  symbol?: string | null;
  name?: string | null;
  imageUrl?: string | null;
}): ResolvedSymbolIdentity | null {
  const displaySymbol = normalizeDisplaySymbol(String(input.symbol || ''));
  if (!displaySymbol) return null;
  return {
    symbol: displaySymbol,
    displaySymbol,
    displayName: companyNameForSymbolUi(input.name, displaySymbol),
    imageUrl: String(input.imageUrl || '').trim() || null,
    market: isKoreanDisplaySymbol(displaySymbol) ? 'kr' : /^[A-Z]/.test(displaySymbol) ? 'global' : 'unknown',
  };
}
