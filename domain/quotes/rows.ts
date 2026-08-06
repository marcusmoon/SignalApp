import type {
  SignalApiCoinMarket,
  SignalApiMarketQuote,
  SignalApiSymbolMeta,
} from '@/integrations/signal-api';
import { pickSymbolMetaLogoUrl, pickSymbolMetaName } from '@/domain/symbols/symbolMetaDisplay';
import { isKoreanDisplaySymbol } from '@/domain/symbols/symbolIdentity';
import { signalMarketQuoteHasValidPrice } from '@/utils/signalMarketQuote';

export type QuoteRow = {
  symbol: string;
  name?: string;
  symbolMeta?: SignalApiSymbolMeta | null;
  quote: SignalApiMarketQuote | null;
  error?: string;
  /** 서버 제공 로고 (코인 `imageUrl` 등). 없으면 SymbolLogo는 글자 아바타 */
  imageUrl?: string | null;
};

/** @deprecated Prefer `isKoreanDisplaySymbol` from `domain/symbols/symbolIdentity`. */
export function isKoreaSymbol(symbol: string): boolean {
  return isKoreanDisplaySymbol(symbol);
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
  if (dp == null || dp === '') return '—';
  const p = Number(dp);
  if (!Number.isFinite(p)) return '—';
  const sign = p >= 0 ? '+' : '-';
  const body = Math.abs(p).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${sign}${body}%`;
}

function finiteQuoteNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function isKoreaStockQuote(row: QuoteRow): boolean {
  return Boolean(row.quote?.krxSymbol) || isKoreanDisplaySymbol(row.symbol);
}

export function mapCoinToSignalMarketQuote(item: SignalApiCoinMarket): SignalApiMarketQuote {
  const c = finiteQuoteNumber(item.currentPrice) ?? Number.NaN;
  const d = finiteQuoteNumber(item.change24h);
  const dp = finiteQuoteNumber(item.changePercent24h);
  const pc = Number.isFinite(c) && d != null ? c - d : Number.NaN;
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
    name: pickSymbolMetaName(item) || undefined,
    symbolMeta: item.symbolMeta ?? null,
    quote: signalMarketQuoteHasValidPrice(item) ? item : null,
    imageUrl: pickSymbolMetaLogoUrl(item),
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
  if (finiteQuoteNumber(item.currentPrice) == null) {
    return { symbol: item.symbol || '—', name: item.name, quote: null, imageUrl };
  }
  return {
    symbol: item.symbol,
    name: item.name,
    quote: mapCoinToSignalMarketQuote(item),
    imageUrl,
  };
}
