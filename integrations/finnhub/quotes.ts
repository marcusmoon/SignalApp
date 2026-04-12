import { fh } from '@/integrations/finnhub/client';
import { DEFAULT_MCAP_TOP_N, MCAP_SCREEN_UNIVERSE } from '@/integrations/finnhub/constants';
import type { FinnhubProfile2, FinnhubQuote, FinnhubStockCandles } from '@/integrations/finnhub/types';

export function finnhubQuoteHasValidPrice(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false;
  const c = (q as { c?: unknown }).c;
  return typeof c === 'number' && Number.isFinite(c);
}

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  return fh<FinnhubQuote>('/quote', { symbol: symbol.trim().toUpperCase() });
}

export async function fetchUsdKrwQuoteApprox(): Promise<FinnhubQuote | null> {
  const now = Math.floor(Date.now() / 1000);
  const from = now - 86400 * 21;
  const candleSymbols = ['OANDA:USD_KRW', 'USD_KRW'];

  for (const symbol of candleSymbols) {
    try {
      const j = await fh<FinnhubStockCandles>('/forex/candle', {
        symbol,
        resolution: 'D',
        from: String(from),
        to: String(now),
      });
      if (j.s === 'ok' && Array.isArray(j.c) && j.c.length > 0) {
        const closes = j.c;
        const last = closes[closes.length - 1]!;
        const prev = closes.length >= 2 ? closes[closes.length - 2]! : last;
        const dp = prev !== 0 ? ((last - prev) / prev) * 100 : 0;
        const t = Array.isArray(j.t) && j.t.length > 0 ? j.t[j.t.length - 1]! : now;
        return {
          c: last,
          d: last - prev,
          dp,
          h: last,
          l: last,
          o: last,
          pc: prev,
          t,
        };
      }
    } catch {
      /* try next symbol */
    }
  }

  try {
    const rates = await fh<{ quote?: Record<string, number> }>('/forex/rates', { base: 'USD' });
    const krw = rates.quote?.KRW;
    if (typeof krw === 'number' && Number.isFinite(krw)) {
      return {
        c: krw,
        d: 0,
        dp: 0,
        h: krw,
        l: krw,
        o: krw,
        pc: krw,
        t: now,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function fetchStockCandles(
  symbol: string,
  resolution: 'D' | 'W' | 'M',
  from: Date,
  to: Date,
): Promise<FinnhubStockCandles | null> {
  const data = await fh<FinnhubStockCandles>('/stock/candle', {
    symbol: symbol.trim().toUpperCase(),
    resolution,
    from: String(Math.floor(from.getTime() / 1000)),
    to: String(Math.floor(to.getTime() / 1000)),
  });
  if (!data || data.s === 'no_data' || !Array.isArray(data.c) || data.c.length === 0) {
    return null;
  }
  return data;
}

export async function fetchQuotesForSymbols(
  symbols: readonly string[],
): Promise<{ symbol: string; quote: FinnhubQuote | null; error?: string }[]> {
  return Promise.all(
    symbols.map(async (sym) => {
      const s = sym.trim().toUpperCase();
      try {
        const quote = await fetchQuote(s);
        if (!finnhubQuoteHasValidPrice(quote)) {
          return { symbol: s, quote: null, error: 'UNKNOWN_SYMBOL' };
        }
        return { symbol: s, quote: quote as FinnhubQuote };
      } catch (e) {
        return {
          symbol: s,
          quote: null,
          error: e instanceof Error ? e.message : 'QUOTE_FETCH_FAILED',
        };
      }
    }),
  );
}

export async function fetchProfile2(symbol: string): Promise<FinnhubProfile2 | null> {
  const s = symbol.trim().toUpperCase();
  try {
    const j = await fh<FinnhubProfile2>('/stock/profile2', { symbol: s });
    if (!j || typeof j !== 'object' || Object.keys(j).length === 0) return null;
    return j;
  } catch {
    return null;
  }
}

const MCAP_PROFILE_FETCH_CHUNK = 10;

export async function getSymbolsSortedByMarketCap(
  universe: readonly string[] = MCAP_SCREEN_UNIVERSE,
  topN: number = DEFAULT_MCAP_TOP_N,
): Promise<string[]> {
  const n = Math.min(Math.max(1, Math.floor(topN)), universe.length);
  const rows: { sym: string; cap: number }[] = [];
  for (let i = 0; i < universe.length; i += MCAP_PROFILE_FETCH_CHUNK) {
    const chunk = universe.slice(i, i + MCAP_PROFILE_FETCH_CHUNK);
    const part = await Promise.all(
      chunk.map(async (sym) => {
        const p = await fetchProfile2(sym);
        const cap = typeof p?.marketCapitalization === 'number' ? p.marketCapitalization : 0;
        return { sym: sym.toUpperCase(), cap };
      }),
    );
    rows.push(...part);
  }
  rows.sort((a, b) => b.cap - a.cap);
  const withCap = rows.filter((r) => r.cap > 0);
  if (withCap.length === 0) {
    return [...universe].slice(0, n).map((s) => s.toUpperCase());
  }
  return withCap.slice(0, n).map((r) => r.sym);
}
