import type {
  FinnhubEconomicRow,
  FinnhubEarningsRow,
  FinnhubNewsRaw,
  FinnhubQuote,
} from '@/integrations/finnhub/types';
import { fetchSignalCalendar } from '@/integrations/signal-api/calendar';
import type { SignalApiCalendarEvent, SignalApiMarketQuote, SignalApiNewsItem } from '@/integrations/signal-api/types';
import { toYmd } from '@/utils/date';

/** Stable pseudo-id for 속보 규칙 등 레거시 키 */
function pseudoNewsId(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

export function signalMarketQuoteToFinnhubQuote(row: SignalApiMarketQuote): FinnhubQuote {
  const c = typeof row.currentPrice === 'number' ? row.currentPrice : Number.NaN;
  const pc = typeof row.previousClose === 'number' ? row.previousClose : c;
  let t = 0;
  if (row.quoteTime) {
    const ms = new Date(row.quoteTime).getTime();
    if (Number.isFinite(ms)) t = Math.floor(ms / 1000);
  }
  return {
    c,
    d: typeof row.change === 'number' ? row.change : 0,
    dp: typeof row.changePercent === 'number' ? row.changePercent : 0,
    h: typeof row.high === 'number' ? row.high : c,
    l: typeof row.low === 'number' ? row.low : c,
    o: typeof row.open === 'number' ? row.open : c,
    pc,
    t,
  };
}

export function signalNewsItemToFinnhubNewsRaw(item: SignalApiNewsItem): FinnhubNewsRaw {
  const publishedMs = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  return {
    category: item.category || 'signal',
    datetime: Number.isFinite(publishedMs) ? Math.floor(publishedMs / 1000) : 0,
    headline: (item.originalTitle || item.title || '').trim(),
    id: pseudoNewsId(String(item.id)),
    image: item.imageUrl || '',
    related: Array.isArray(item.symbols) ? item.symbols.join(',') : '',
    source: item.sourceName || '',
    summary: (item.originalSummary || item.summary || '').trim(),
    url: item.sourceUrl || '',
  };
}

export function signalCalendarRowToFinnhubEarningsRow(ev: SignalApiCalendarEvent): FinnhubEarningsRow | null {
  if (ev.type !== 'earnings') return null;
  const raw = ev.rawPayload as Partial<FinnhubEarningsRow> | null | undefined;
  if (raw && raw.symbol && raw.date) {
    return {
      date: String(raw.date),
      epsActual: typeof raw.epsActual === 'number' ? raw.epsActual : null,
      epsEstimate: typeof raw.epsEstimate === 'number' ? raw.epsEstimate : null,
      hour: String(raw.hour ?? ev.earningsHour ?? ev.timeLabel ?? ''),
      quarter: typeof raw.quarter === 'number' ? raw.quarter : 1,
      revenueActual: typeof raw.revenueActual === 'number' ? raw.revenueActual : null,
      revenueEstimate: typeof raw.revenueEstimate === 'number' ? raw.revenueEstimate : null,
      symbol: String(raw.symbol).trim().toUpperCase(),
      year:
        typeof raw.year === 'number' && Number.isFinite(raw.year)
          ? raw.year
          : Number(String(raw.date).slice(0, 4)) || new Date().getFullYear(),
    };
  }

  const sym = String(ev.symbol || '').trim().toUpperCase();
  const date = String(ev.date || '').trim();
  if (!sym || date.length < 10) return null;

  let year =
    typeof ev.fiscalYear === 'number' && Number.isFinite(ev.fiscalYear)
      ? ev.fiscalYear
      : Number(date.slice(0, 4));
  if (!Number.isFinite(year)) year = new Date().getFullYear();

  const quarter =
    typeof ev.fiscalQuarter === 'number' && Number.isFinite(ev.fiscalQuarter) ? ev.fiscalQuarter : 1;

  const hourRaw = String(ev.earningsHour || ev.timeLabel || '').trim();

  return {
    date,
    epsActual: typeof ev.actual === 'number' ? ev.actual : null,
    epsEstimate: typeof ev.estimate === 'number' ? ev.estimate : null,
    hour: hourRaw,
    quarter,
    revenueActual: null,
    revenueEstimate: null,
    symbol: sym,
    year,
  };
}

/** Macro / Fed / FOMC 캘린더 행 → 브리핑용 Finnhub 경제 지표 형태 */
export function signalCalendarRowToFinnhubEconomicRow(ev: SignalApiCalendarEvent): FinnhubEconomicRow | null {
  if (ev.type === 'earnings') return null;
  const iso = ev.eventAt?.trim();
  let timeStr = '';
  if (iso && iso.includes('T')) {
    const dPart = iso.slice(0, 10);
    const tail = iso.slice(11, 19).replace(/\.\d+$/, '').replace(/Z$/, '');
    const hm = tail.slice(0, 5);
    timeStr = /^(\d{2}:\d{2})$/.test(hm) ? `${dPart} ${hm}:00` : iso.replace('T', ' ').slice(0, 19);
  } else if (ev.date && ev.timeLabel) {
    timeStr = `${ev.date} ${ev.timeLabel}`.slice(0, 32);
  } else if (ev.date) {
    timeStr = `${ev.date} 00:00:00`;
  }

  const imp = ev.impact ? String(ev.impact) : '';
  const title = String(ev.title || '').trim();

  return {
    actual: ev.actual ?? null,
    country: ev.country ?? '',
    estimate: ev.estimate ?? null,
    event: title || ev.type || 'macro',
    impact: imp || 'medium',
    prev: ev.previous ?? null,
    time: timeStr || `${ev.date || ''}`,
    unit: ev.unit ?? '',
  };
}

export async function fetchSignalMacroCalendarRangeMerged(from: Date, to: Date): Promise<FinnhubEconomicRow[]> {
  const rows = await fetchSignalCalendar({
    from: toYmd(from),
    to: toYmd(to),
  });
  const out: FinnhubEconomicRow[] = [];
  for (const r of rows) {
    if (r.type === 'earnings') continue;
    const m = signalCalendarRowToFinnhubEconomicRow(r);
    if (!m || String(m.time || '').length < 10) continue;
    out.push(m);
  }
  return [...out].sort((a, b) => String(a.time).localeCompare(String(b.time)));
}

export async function fetchSignalEarningsCalendarRangeMerged(from: Date, to: Date): Promise<FinnhubEarningsRow[]> {
  const rows = await fetchSignalCalendar({
    from: toYmd(from),
    to: toYmd(to),
    type: 'earnings',
  });
  const out: FinnhubEarningsRow[] = [];
  for (const r of rows) {
    const e = signalCalendarRowToFinnhubEarningsRow(r);
    if (e) out.push(e);
  }
  return [...out].sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
}
