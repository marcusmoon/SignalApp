import { MEGA_CAP_SET, normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
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

/** Finnhub 시장 뉴스: `general` · `forex` · `crypto` · `merger` */
export type FinnhubMarketNewsCategory = 'general' | 'forex' | 'crypto' | 'merger';

export async function fetchMarketNews(category: FinnhubMarketNewsCategory): Promise<FinnhubNewsRaw[]> {
  const data = await fh<FinnhubNewsRaw[]>('/news', { category });
  return Array.isArray(data) ? data : [];
}

export async function fetchGeneralNews(): Promise<FinnhubNewsRaw[]> {
  return fetchMarketNews('general');
}

export function mergeNewsById(...lists: FinnhubNewsRaw[][]): FinnhubNewsRaw[] {
  const map = new Map<number, FinnhubNewsRaw>();
  for (const list of lists) {
    for (const r of list) {
      if (!map.has(r.id)) map.set(r.id, r);
    }
  }
  return [...map.values()].sort((a, b) => b.datetime - a.datetime);
}

export async function fetchEarningsCalendarRange(from: Date, to: Date): Promise<FinnhubEarningsRow[]> {
  const j = await fh<{ earningsCalendar: FinnhubEarningsRow[] }>('/calendar/earnings', {
    from: toYmd(from),
    to: toYmd(to),
  });
  return j.earningsCalendar ?? [];
}

/**
 * 긴 기간을 한 번에 요청하면 Finnhub가 빈 배열·누락을 내는 경우가 있어 90일 단위로 나눠 합칩니다.
 */
export async function fetchEarningsCalendarRangeMerged(from: Date, to: Date): Promise<FinnhubEarningsRow[]> {
  const seen = new Set<string>();
  const out: FinnhubEarningsRow[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const endT = to.getTime();
  while (cursor.getTime() <= endT) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + 89);
    if (chunkEnd.getTime() > endT) {
      chunkEnd.setTime(endT);
    }
    const chunk = await fetchEarningsCalendarRange(cursor, chunkEnd);
    for (const r of chunk) {
      const key = `${r.symbol}|${r.date}|${r.quarter}|${r.year}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(r);
      }
    }
    const next = new Date(chunkEnd);
    next.setDate(next.getDate() + 1);
    cursor.setTime(next.getTime());
  }
  return out;
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
    title: `${r.symbol} (FY${r.year} Q${r.quarter})`,
    type: 'earnings' as const,
  }));
}

function classifyMacro(event: string): 'fomc' | 'fed' | 'macro' {
  const u = event.toUpperCase();
  if (u.includes('FOMC')) return 'fomc';
  if (u.includes('FED ') || u.includes('FEDERAL RESERVE') || u.includes('Powell')) return 'fed';
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

/** Finnhub `/quote` 응답 — 미존재·잘못된 티커는 `{}` 등으로 `c`가 없을 수 있음 */
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

/** `/quote` JSON에 유효한 현재가가 있는지 (없는 종목은 보통 `c` 누락) */
export function finnhubQuoteHasValidPrice(q: unknown): boolean {
  if (!q || typeof q !== 'object') return false;
  const c = (q as { c?: unknown }).c;
  return typeof c === 'number' && Number.isFinite(c);
}

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
        if (!finnhubQuoteHasValidPrice(quote)) {
          return { symbol: s, quote: null, error: 'UNKNOWN_SYMBOL' };
        }
        return { symbol: s, quote: quote as FinnhubQuote };
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

/** 시총 상위 산출용 유니버스(미국 대형주 위주, 설정 개수 상한 100에 맞춤) */
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
  'LLY',
  'MRK',
  'PEP',
  'TMO',
  'ABT',
  'DHR',
  'CSCO',
  'ACN',
  'DIS',
  'CMCSA',
  'NKE',
  'PM',
  'TXN',
  'LIN',
  'QCOM',
  'AMGN',
  'HON',
  'UPS',
  'LOW',
  'SBUX',
  'AMAT',
  'INTU',
  'ISRG',
  'BKNG',
  'ADBE',
  'GE',
  'CAT',
  'DE',
  'GS',
  'MS',
  'BLK',
  'SCHW',
  'SPGI',
  'MDT',
  'ZTS',
  'CI',
  'SYK',
  'MO',
  'PFE',
  'T',
  'CME',
  'EQIX',
  'ICE',
  'AXP',
  'TJX',
  'REGN',
  'CL',
  'EL',
  'NEE',
  'DUK',
  'SO',
  'PLD',
  'MMC',
  'CB',
  'AON',
  'ECL',
  'SHW',
  'ITW',
  'EMR',
  'FCX',
  'OXY',
  'MET',
  'PYPL',
  'CRWD',
  'NOW',
  'UBER',
  'ABNB',
  'LRCX',
  'MU',
  'ADI',
  'SNPS',
  'CDNS',
  'PANW',
  'FTNT',
  'MMM',
  'RTX',
  'BA',
  'LMT',
] as const;

/** 인기순: 거래·관심이 많은 순으로 큐레이션한 고정 순서 (20개) */
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
  'BRK-B',
  'JPM',
  'NFLX',
  'UNH',
  'AVGO',
  'XOM',
] as const;

/** 기본 시총순 상위 개수 (설정에서 덮어쓸 수 있음) */
export const DEFAULT_MCAP_TOP_N = 20;

const MCAP_PROFILE_FETCH_CHUNK = 10;

/** 시총(백만 USD) 내림차순 심볼 목록 상위 `topN`개 */
export async function getSymbolsSortedByMarketCap(
  universe: readonly string[] = MCAP_SCREEN_UNIVERSE,
  topN: number = DEFAULT_MCAP_TOP_N,
): Promise<string[]> {
  const n = Math.min(
    Math.max(1, Math.floor(topN)),
    universe.length,
  );
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

export async function fetchCalendarEventsMerged(
  daysAhead = 14,
  options?: {
    scope: CalendarConcallScope;
    watchlistSymbols?: string[];
    /** 지정 시 Finnhub from/to. 미지정 시 오늘부터 daysAhead일 */
    rangeFrom?: Date;
    rangeTo?: Date;
  },
): Promise<CalendarEvent[]> {
  const from = options?.rangeFrom ?? new Date();
  const to = options?.rangeTo ?? addDays(from, daysAhead);
  let earn: FinnhubEarningsRow[] = [];
  let eco: FinnhubEconomicRow[] = [];
  try {
    earn = await fetchEarningsCalendarRange(from, to);
  } catch {
    earn = [];
  }
  const scope = options?.scope ?? 'mega';
  if (scope === 'mega') {
    earn = earn.filter(
      (r) => r.symbol && MEGA_CAP_SET.has(normalizeEarningsSymbolForMatch(r.symbol)),
    );
  } else {
    const syms = options?.watchlistSymbols ?? [];
    const set = new Set(syms.map((s) => normalizeEarningsSymbolForMatch(s)).filter(Boolean));
    if (set.size === 0) {
      earn = [];
    } else {
      earn = earn.filter(
        (r) => r.symbol && set.has(normalizeEarningsSymbolForMatch(r.symbol)),
      );
    }
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
