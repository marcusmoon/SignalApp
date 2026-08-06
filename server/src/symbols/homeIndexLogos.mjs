/**
 * Home index tiles use caret Yahoo symbols (^GSPC …) which have no Parqet logos.
 * Logo comes from a tracking ETF / proxy ticker stored in symbol_profiles.
 * Keep in sync with `domain/home/homeIndices.ts` logoSymbol.
 */
import { publicSymbolMeta } from './symbolProfiles.mjs';

export const HOME_INDEX_LOGO_PROXIES = {
  '^GSPC': { market: 'global', symbol: 'SPY', name: 'S&P 500' },
  '^NDX': { market: 'global', symbol: 'QQQ', name: 'Nasdaq-100' },
  '^DJI': { market: 'global', symbol: 'DIA', name: 'Dow Jones' },
  '^SOX': { market: 'global', symbol: 'SOXX', name: 'PHLX Semiconductor' },
  '^KS11': { market: 'kr', symbol: '069500', name: 'KOSPI' },
  '^N225': { market: 'global', symbol: 'EWJ', name: 'Nikkei 225' },
};

export function homeIndexLogoProxy(symbol) {
  const key = String(symbol || '').trim().toUpperCase();
  return HOME_INDEX_LOGO_PROXIES[key] || null;
}

/** Lookup identity for the ETF proxy behind a caret index quote. */
export function homeIndexLogoIdentity(symbol) {
  const proxy = homeIndexLogoProxy(symbol);
  if (!proxy) return null;
  return { market: proxy.market, symbol: proxy.symbol, displaySymbol: proxy.symbol };
}

/**
 * Build symbolMeta for a caret index row from the proxy profile (logo URL).
 * Returns null when not an index or when no usable meta can be formed.
 */
export function homeIndexSymbolMeta(symbol, profiles) {
  const proxy = homeIndexLogoProxy(symbol);
  if (!proxy) return null;
  const logoKey = `${proxy.market}:${proxy.symbol}`;
  const logoProfile = profiles?.get?.(logoKey) || null;
  const logoUrl = logoProfile?.logoUrl || null;
  if (!logoUrl && !proxy.name) return null;
  return publicSymbolMeta({
    market: proxy.market,
    symbol: proxy.symbol,
    displaySymbol: proxy.symbol,
    name: proxy.name,
    logoUrl,
  });
}
