import { env, hasFinnhub } from '@/services/env';
import { addDays, toYmd } from '@/utils/date';
import type { CalendarEvent } from '@/types/signal';

export type FinnhubNewsRaw = {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
};

export type FinnhubEarningsRow = {
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  revenueActual: number | null;
  revenueEstimate: number | null;
  symbol: string;
  year: number;
};

export type FinnhubEconomicRow = {
  actual: number | null;
  country: string;
  estimate: number | null;
  event: string;
  impact: string;
  prev: number | null;
  time: string;
  unit: string;
};

async function fh<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!hasFinnhub()) throw new Error('FINNHUB_TOKEN_MISSING');
  const q = new URLSearchParams({ ...params, token: env.finnhubToken });
  const res = await fetch(`https://finnhub.io/api/v1${path}?${q.toString()}`);
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Finnhub ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchGeneralNews(): Promise<FinnhubNewsRaw[]> {
  const data = await fh<FinnhubNewsRaw[]>('/news', { category: 'general' });
  return Array.isArray(data) ? data : [];
}

export async function fetchEarningsCalendarRange(from: Date, to: Date): Promise<FinnhubEarningsRow[]> {
  const j = await fh<{ earningsCalendar: FinnhubEarningsRow[] }>('/calendar/earnings', {
    from: toYmd(from),
    to: toYmd(to),
  });
  return j.earningsCalendar ?? [];
}

export async function fetchEconomicCalendarRange(from: Date, to: Date): Promise<FinnhubEconomicRow[]> {
  const j = await fh<{ economicCalendar: FinnhubEconomicRow[] }>('/calendar/economic', {
    from: toYmd(from),
    to: toYmd(to),
  });
  return j.economicCalendar ?? [];
}

export function mapEarningsToEvents(rows: FinnhubEarningsRow[]): CalendarEvent[] {
  return rows.map((r) => ({
    id: `e-${r.symbol}-${r.date}-${r.quarter}-${r.year}`,
    date: r.date,
    time: r.hour === 'bmo' ? '프리마켓' : r.hour === 'amc' ? '애프터마켓' : r.hour || '—',
    title: `${r.symbol} 실적 (FY${r.year} Q${r.quarter})`,
    type: 'earnings' as const,
  }));
}

function classifyMacro(event: string): 'fed' | 'macro' {
  const u = event.toUpperCase();
  if (u.includes('FOMC') || u.includes('FED ') || u.includes('FEDERAL RESERVE') || u.includes('Powell')) return 'fed';
  return 'macro';
}

export function mapEconomicToEvents(rows: FinnhubEconomicRow[]): CalendarEvent[] {
  return rows.map((r, i) => {
    const type = classifyMacro(r.event);
    const time = r.time && r.time.length >= 16 ? r.time.slice(11, 16) + ' ET' : r.time || '—';
    return {
      id: `m-${r.country}-${i}-${r.time}`,
      date: r.time ? r.time.slice(0, 10) : '—',
      time,
      title: r.event,
      type,
    };
  });
}

/** Finnhub `/stock/candle` 아님 — `/quote` 단일 심볼 시세 */
export type FinnhubQuote = {
  /** 현재가(또는 마지막 거래가) */
  c: number;
  /** 전일 대비 변동 */
  d: number;
  /** 전일 대비 변동 % */
  dp: number;
  h: number;
  l: number;
  o: number;
  /** 전일 종가 */
  pc: number;
  t: number;
};

/** 시세 · 관심 탭 기본값 (설정에서 초기화 시 동일) */
export const DEFAULT_US_WATCHLIST = [
  'NVDA',
  'GOOGL',
  'AAPL',
  'TSLA',
  'BMNR',
  'MU',
  'PLTR',
  'CRCL',
  'SPY',
  'QQQ',
] as const;

export async function fetchQuote(symbol: string): Promise<FinnhubQuote> {
  return fh<FinnhubQuote>('/quote', { symbol: symbol.trim().toUpperCase() });
}

export async function fetchQuotesForSymbols(
  symbols: readonly string[],
): Promise<{ symbol: string; quote: FinnhubQuote | null; error?: string }[]> {
  return Promise.all(
    symbols.map(async (sym) => {
      const s = sym.trim().toUpperCase();
      try {
        const quote = await fetchQuote(s);
        return { symbol: s, quote };
      } catch (e) {
        return {
          symbol: s,
          quote: null,
          error: e instanceof Error ? e.message : '조회 실패',
        };
      }
    }),
  );
}

/** Finnhub `marketCapitalization`은 백만 달러 단위 */
export type FinnhubProfile2 = {
  symbol?: string;
  name?: string;
  marketCapitalization?: number;
};

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

/** 시총 상위 산출용 유니버스(미국 대형주·대표 ETF 일부) */
export const MCAP_SCREEN_UNIVERSE = [
  'AAPL',
  'MSFT',
  'GOOGL',
  'AMZN',
  'NVDA',
  'META',
  'AVGO',
  'TSLA',
  'BRK-B',
  'JPM',
  'WMT',
  'UNH',
  'XOM',
  'JNJ',
  'V',
  'PG',
  'MA',
  'ORCL',
  'COST',
  'HD',
  'ABBV',
  'BAC',
  'KO',
  'NFLX',
  'AMD',
] as const;

/** 인기순: 거래·관심이 많은 순으로 큐레이션한 고정 순서 */
export const POPULAR_SYMBOLS_ORDERED = [
  'NVDA',
  'TSLA',
  'AAPL',
  'AMD',
  'META',
  'AMZN',
  'GOOGL',
  'MSFT',
  'MSTR',
  'COIN',
  'PLTR',
  'SPY',
  'QQQ',
  'IWM',
] as const;

const MCAP_TOP_N = 15;

/** 시총(백만 USD) 내림차순 심볼 목록 */
export async function getSymbolsSortedByMarketCap(
  universe: readonly string[] = MCAP_SCREEN_UNIVERSE,
): Promise<string[]> {
  const rows = await Promise.all(
    universe.map(async (sym) => {
      const p = await fetchProfile2(sym);
      const cap = typeof p?.marketCapitalization === 'number' ? p.marketCapitalization : 0;
      return { sym: sym.toUpperCase(), cap };
    }),
  );
  rows.sort((a, b) => b.cap - a.cap);
  const withCap = rows.filter((r) => r.cap > 0);
  if (withCap.length === 0) {
    return [...universe].slice(0, MCAP_TOP_N).map((s) => s.toUpperCase());
  }
  return withCap.slice(0, MCAP_TOP_N).map((r) => r.sym);
}

export async function fetchCalendarEventsMerged(daysAhead = 14): Promise<CalendarEvent[]> {
  const from = new Date();
  const to = addDays(from, daysAhead);
  let earn: FinnhubEarningsRow[] = [];
  let eco: FinnhubEconomicRow[] = [];
  try {
    earn = await fetchEarningsCalendarRange(from, to);
  } catch {
    earn = [];
  }
  try {
    eco = await fetchEconomicCalendarRange(from, to);
  } catch {
    eco = [];
  }
  const a = [...mapEarningsToEvents(earn), ...mapEconomicToEvents(eco)];
  a.sort((x, y) => x.date.localeCompare(y.date) || x.title.localeCompare(y.title));
  return a;
}
