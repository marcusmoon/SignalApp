import type { SignalApiSymbolMeta } from '@/integrations/signal-api';
import {
  companyNameForSymbolUi,
  normalizeDisplaySymbol,
  resolveSymbolIdentity,
  type ResolvedSymbolIdentity,
} from './symbolIdentity.ts';

type SymbolMetaRowLike = {
  symbol?: string | null;
  displaySymbol?: string | null;
  name?: string | null;
  companyName?: string | null;
  imageUrl?: string | null;
  symbolMeta?: SignalApiSymbolMeta | null;
};

/** Prefer API `symbolMeta.name`, then legacy name / companyName. */
export function pickSymbolMetaName(row: SymbolMetaRowLike | null | undefined): string | null {
  const meta = String(row?.symbolMeta?.name || '').trim();
  if (meta) return meta;
  const legacy = String(row?.name || row?.companyName || '').trim();
  return legacy || null;
}

/** Prefer API `symbolMeta.logoUrl`, then legacy `imageUrl`. */
export function pickSymbolMetaLogoUrl(row: SymbolMetaRowLike | null | undefined): string | null {
  const meta = String(row?.symbolMeta?.logoUrl || '').trim();
  if (/^https?:\/\//i.test(meta)) return meta;
  const imageUrl = String(row?.imageUrl || '').trim();
  return /^https?:\/\//i.test(imageUrl) ? imageUrl : null;
}

/** Symbol string for display / lookup (displaySymbol → symbol). */
export function pickSymbolMetaSymbol(row: SymbolMetaRowLike | null | undefined): string {
  return normalizeDisplaySymbol(String(row?.symbolMeta?.displaySymbol || row?.displaySymbol || row?.symbol || ''));
}

/**
 * Resolve list/tile identity from an API quote/company row.
 * Global tickers stay ticker-only (no company name).
 */
export function resolveRowSymbolIdentity(row: SymbolMetaRowLike | null | undefined): ResolvedSymbolIdentity | null {
  const symbol = pickSymbolMetaSymbol(row);
  if (!symbol) return null;
  return resolveSymbolIdentity({
    symbol,
    name: companyNameForSymbolUi(pickSymbolMetaName(row), symbol),
    imageUrl: pickSymbolMetaLogoUrl(row),
  });
}
