function normalizeKrxCode(symbol: string): string | null {
  const digits = String(symbol || '').replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

function usTickerPath(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/\./g, '-');
}

type GoogleFinanceExchange = 'KRX' | 'NASDAQ' | 'NYSE';

/** Google Finance quote path — `TICKER:EXCHANGE` (예: `005930:KRX`, `AAPL:NASDAQ`) */
export function googleFinanceQuotePath(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): string | null {
  const trimmed = String(symbol || '').trim().toUpperCase();
  if (!trimmed) return null;

  const krx = normalizeKrxCode(trimmed);
  if (krx) {
    return `${krx}:KRX`;
  }

  const yahoo = hint?.yahooSymbol?.trim().toUpperCase();
  if (yahoo?.endsWith('.KS') || yahoo?.endsWith('.KQ')) {
    const code = yahoo.replace(/\.(KS|KQ)$/i, '');
    if (/^\d{6}$/.test(code)) return `${code}:KRX`;
  }

  const ticker = yahoo && !yahoo.includes('.') ? usTickerPath(yahoo) : usTickerPath(trimmed);
  const exchange: GoogleFinanceExchange = 'NASDAQ';
  return `${ticker}:${exchange}`;
}

/** Google Finance 종목 상세 — `/quote/TICKER:EXCHANGE` */
export function googleFinanceQuoteUrl(
  symbol: string,
  hint?: { yahooSymbol?: string | null },
): string {
  const path = googleFinanceQuotePath(symbol, hint);
  if (!path) return 'https://www.google.com/finance';
  return `https://www.google.com/finance/quote/${encodeURIComponent(path)}`;
}
