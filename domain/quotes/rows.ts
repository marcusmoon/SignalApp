import type {
  SignalApiCoinMarket,
  SignalApiMarketQuote,
} from '@/integrations/signal-api';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';

export type QuoteRow = {
  symbol: string;
  name?: string;
  quote: SignalApiMarketQuote | null;
  error?: string;
  /** 서버 제공 로고 (코인). 없으면 SymbolLogo가 Parqet 시도 */
  imageUrl?: string | null;
};

export function isKoreaSymbol(symbol: string): boolean {
  return /^\d{6}$/.test(String(symbol || '').trim());
}

export async function withSoftTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function formatUsdBody(abs: number): string {
  if (!Number.isFinite(abs) || abs < 0) return '—';
  if (abs >= 1000) return abs.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (abs >= 1) return abs.toFixed(2);
  if (abs >= 0.0001) return abs.toFixed(6);
  return abs.toFixed(8);
}

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `$${formatUsdBody(Math.abs(n))}`;
}

export function formatUsdChange(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '$0';
  const sign = n > 0 ? '+' : '-';
  const body = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${sign}$${body}`;
}

function toFiniteDisplayNumber(value: unknown): number {
  if (value == null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function formatKrw(value: unknown): string {
  const n = toFiniteDisplayNumber(value);
  if (!Number.isFinite(n)) return '—';
  return `₩${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
}

export function formatKrwChange(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '₩0';
  const sign = n > 0 ? '+' : '-';
  return `${sign}₩${Math.round(Math.abs(n)).toLocaleString('ko-KR')}`;
}

export function formatQuoteDpPct(dp: unknown): string {
  if (!Number.isFinite(dp)) return '—';
  const p = dp as number;
  const sign = p >= 0 ? '+' : '-';
  const body = Math.abs(p).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${sign}${body}%`;
}

export function isKoreaStockQuote(row: QuoteRow): boolean {
  return Boolean(row.quote?.krxSymbol) || /^\d{6}$/.test(String(row.symbol || '').trim());
}

export function mapCoinToSignalMarketQuote(item: SignalApiCoinMarket): SignalApiMarketQuote {
  const price = item.currentPrice;
  const c = typeof price === 'number' && Number.isFinite(price) ? price : Number.NaN;
  const d = item.change24h ?? 0;
  const dp = item.changePercent24h ?? 0;
  const pc = Number.isFinite(c) ? c - d : Number.NaN;
  return {
    id: item.id,
    provider: item.provider,
    providerItemId: item.providerItemId,
    segment: 'coin',
    symbol: item.symbol,
    name: item.name,
    imageUrl: item.imageUrl ?? null,
    currentPrice: Number.isFinite(c) ? c : null,
    change: d,
    changePercent: dp,
    high: null,
    low: null,
    open: null,
    previousClose: Number.isFinite(pc) ? pc : null,
    marketCapitalization: item.marketCap,
    quoteTime: null,
    fetchedAt: item.fetchedAt,
  };
}

export function mapSignalQuoteToRow(item: SignalApiMarketQuote): QuoteRow {
  return {
    symbol: item.displaySymbol || item.symbol,
    name: item.name || undefined,
    quote: signalMarketQuoteHasValidPrice(item) ? item : null,
    imageUrl: item.imageUrl ?? null,
  };
}

export function quoteLookupKeys(item: SignalApiMarketQuote, row: QuoteRow): string[] {
  return [
    row.symbol,
    item.symbol,
    item.displaySymbol,
    item.krxSymbol,
    item.providerItemId,
    item.regularSession?.yahooSymbol,
  ]
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean);
}

export function mapSignalCoinToRow(item: SignalApiCoinMarket): QuoteRow {
  const imageUrl = item.imageUrl ?? null;
  const price = item.currentPrice;
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return { symbol: item.symbol || '—', name: item.name, quote: null, imageUrl };
  }
  return {
    symbol: item.symbol,
    name: item.name,
    quote: mapCoinToSignalMarketQuote(item),
    imageUrl,
  };
}
