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

type SymbolMetaLike = {
  name?: string | null;
  logoUrl?: string | null;
  displaySymbol?: string | null;
} | null | undefined;

type SymbolRowLike = {
  symbol?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  symbolMeta?: SymbolMetaLike;
} | null;

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

export type HomeKeywordSymbolProfile = {
  name: string | null;
  logoUrl: string | null;
};

function preferredName(row: SymbolRowLike, key: string): string | null {
  // Global letter tickers stay ticker-only in home keyword / quote UIs.
  if (!/^\d{6}$/.test(key)) return null;
  const metaName = String(row?.symbolMeta?.name || '').trim();
  if (isUsableCompanyName(metaName, key)) return metaName;
  const rowName = String(row?.name || '').trim();
  if (isUsableCompanyName(rowName, key)) return rowName;
  return null;
}

function preferredLogo(row: SymbolRowLike): string | null {
  const metaLogo = String(row?.symbolMeta?.logoUrl || '').trim();
  if (/^https?:\/\//i.test(metaLogo)) return metaLogo;
  const imageUrl = String(row?.imageUrl || '').trim();
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return null;
}

/**
 * Build symbol → name/logo from briefing companies and quote rows.
 * Prefers API `symbolMeta` (DB symbol_profiles) over legacy row fields.
 */
export function buildHomeKeywordSymbolProfiles(input: {
  companies?: SymbolRowLike[] | null;
  quotes?: SymbolRowLike[] | null;
}): Map<string, HomeKeywordSymbolProfile> {
  const map = new Map<string, HomeKeywordSymbolProfile>();
  const put = (row: SymbolRowLike) => {
    const key = homeKeywordSymbolKey(String(row?.symbol || ''));
    if (!key) return;
    const name = preferredName(row, key);
    const logoUrl = preferredLogo(row);
    if (!name && !logoUrl) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { name, logoUrl });
      return;
    }
    map.set(key, {
      name: prev.name || name,
      logoUrl: prev.logoUrl || logoUrl,
    });
  };
  for (const row of input.companies ?? []) put(row);
  for (const row of input.quotes ?? []) put(row);
  return map;
}

/** @deprecated Prefer `buildHomeKeywordSymbolProfiles` — name-only view of profiles. */
export function buildHomeKeywordSymbolNames(input: {
  companies?: SymbolRowLike[] | null;
  quotes?: SymbolRowLike[] | null;
}): Map<string, string> {
  const names = new Map<string, string>();
  for (const [key, profile] of buildHomeKeywordSymbolProfiles(input)) {
    if (profile.name) names.set(key, profile.name);
  }
  return names;
}

export function homeKeywordChipIdentity(
  chip: KeywordChipLike,
  symbolProfiles: Map<string, HomeKeywordSymbolProfile> | Map<string, string>,
): ResolvedSymbolIdentity | null {
  if (!homeKeywordIsSymbolChip(chip)) return null;
  const symbol = homeKeywordSymbolKey(chip.label);
  const embedded = String(chip.name || '').trim();
  const entry = symbolProfiles.get(symbol);
  const profileName =
    typeof entry === 'string'
      ? entry
      : entry && typeof entry === 'object'
        ? entry.name
        : null;
  const profileLogo =
    entry && typeof entry === 'object' ? entry.logoUrl : null;
  const identity = resolveSymbolIdentity({
    symbol,
    name: isUsableCompanyName(embedded, symbol) ? embedded : profileName,
    imageUrl: profileLogo,
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
  symbolProfiles: Map<string, HomeKeywordSymbolProfile> | Map<string, string>,
): string {
  if (!homeKeywordIsSymbolChip(chip)) return chip.label;
  const identity = homeKeywordChipIdentity(chip, symbolProfiles);
  if (!identity) return chip.label;
  return identity.displayName || identity.displaySymbol;
}
