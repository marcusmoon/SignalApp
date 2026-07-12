function normalizeKrxCode(symbol: string): string | null {
  const digits = String(symbol || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

function usTickerPath(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\./g, '-');
}

/** Google Finance는 `TICKER:EXCHANGE` 또는 검색 쿼리가 필요함 */
export function googleFinanceQuoteUrl(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): string {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return 'https://www.google.com/finance';

  const krx = normalizeKrxCode(trimmed);
  if (krx) {
    const yahoo = hint?.yahooSymbol?.trim().toUpperCase();
    if (yahoo?.endsWith('.KQ')) {
      return `https://www.google.com/finance/quote/KOSDAQ:${encodeURIComponent(krx)}`;
    }
    return `https://www.google.com/finance/quote/KRX:${encodeURIComponent(krx)}`;
  }

  const yahoo = hint?.yahooSymbol?.trim().toUpperCase();
  if (yahoo?.endsWith('.KS')) {
    const code = yahoo.replace('.KS', '');
    return `https://www.google.com/finance/quote/KRX:${encodeURIComponent(code)}`;
  }
  if (yahoo?.endsWith('.KQ')) {
    const code = yahoo.replace('.KQ', '');
    return `https://www.google.com/finance/quote/KOSDAQ:${encodeURIComponent(code)}`;
  }

  const query = yahoo && !yahoo.includes('.') ? yahoo : usTickerPath(trimmed);
  return `https://www.google.com/finance/search?q=${encodeURIComponent(query)}`;
}
