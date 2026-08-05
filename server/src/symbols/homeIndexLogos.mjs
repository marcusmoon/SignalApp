/**
 * Home index tiles use caret Yahoo symbols (^GSPC …) which have no Parqet logos.
 * Logo comes from a tracking ETF / proxy ticker stored in symbol_profiles.
 * Keep in sync with `domain/home/homeIndices.ts` logoSymbol.
 */
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
