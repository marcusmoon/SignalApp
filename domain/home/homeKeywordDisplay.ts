import {
  isUsableCompanyDisplayName,
  normalizeDisplaySymbol,
  resolveSymbolIdentity,
  type ResolvedSymbolIdentity,
} from '../symbols/symbolIdentity.ts';

type KeywordChipLike = {
  label: string;
  kind: string;
  weight: number;
  name?: string;
};

/** Canonical map key for keyword symbol lookup (`005930.KS` → `005930`). */
export function homeKeywordSymbolKey(label: string): string {
  return normalizeDisplaySymbol(label);
}

/** KR codes (bare or Yahoo suffix). US letter tickers are kind-driven, not inferred. */
export function isTickerLikeLabel(label: string): boolean {
  const text = String(label || '').trim().toUpperCase();
  if (!text) return false;
  return /^\d{6}(\.(KS|KQ))?$/.test(text);
}

/** Reject names that are just the ticker / code again. */
export function isUsableCompanyName(name: string, symbolKey: string): boolean {
  return isUsableCompanyDisplayName(name, symbolKey);
}

/** Build symbol → company/display name from briefing companies and quote rows. */
export function buildHomeKeywordSymbolNames(input: {
  companies?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
  quotes?: Array<{ symbol?: string | null; name?: string | null } | null> | null;
}): Map<string, string> {
  const map = new Map<string, string>();
  const put = (symbol?: string | null, name?: string | null) => {
    const key = homeKeywordSymbolKey(String(symbol || ''));
    if (!key || !isUsableCompanyName(String(name || ''), key)) return;
    if (!map.has(key)) map.set(key, String(name).trim());
  };
  for (const row of input.companies ?? []) put(row?.symbol, row?.name);
  for (const row of input.quotes ?? []) put(row?.symbol, row?.name);
  return map;
}

export function homeKeywordChipIdentity(
  chip: KeywordChipLike,
  symbolNames: Map<string, string>,
): ResolvedSymbolIdentity | null {
  if (!homeKeywordIsSymbolChip(chip)) return null;
  const symbol = homeKeywordSymbolKey(chip.label);
  const embedded = String(chip.name || '').trim();
  const fallback = symbolNames.get(symbol) || null;
  const identity = resolveSymbolIdentity({
    symbol,
    name: isUsableCompanyName(embedded, symbol) ? embedded : fallback,
  });
  // Home trends use Korean issuer names for KRX codes; US trends remain compact tickers.
  return identity?.market === 'global' ? { ...identity, displayName: null } : identity;
}

/** True when the chip should display as a symbol (logo + company name). */
export function homeKeywordIsSymbolChip(chip: KeywordChipLike): boolean {
  return chip.kind === 'symbol' || isTickerLikeLabel(chip.label);
}

/** Legacy single-label helper retained for non-rich fallbacks/tests. */
export function homeKeywordChipLabel(
  chip: KeywordChipLike,
  symbolNames: Map<string, string>,
): string {
  if (!homeKeywordIsSymbolChip(chip)) return chip.label;
  const identity = homeKeywordChipIdentity(chip, symbolNames);
  if (!identity) return chip.label;
  return identity.displayName || identity.displaySymbol;
}
