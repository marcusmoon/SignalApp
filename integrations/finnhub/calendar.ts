import { MEGA_CAP_SET, normalizeEarningsSymbolForMatch } from '@/constants/megaCapUniverse';
import { fh } from '@/integrations/finnhub/client';
import type { CalendarConcallScope } from '@/services/calendarConcallScopePreference';
import type { FinnhubEconomicRow, FinnhubEarningsRow } from '@/integrations/finnhub/types';
import type { CalendarEvent } from '@/types/signal';
import { addDays, toYmd } from '@/utils/date';

export async function fetchEarningsCalendarRange(from: Date, to: Date): Promise<FinnhubEarningsRow[]> {
  const j = await fh<{ earningsCalendar: FinnhubEarningsRow[] }>('/calendar/earnings', {
    from: toYmd(from),
    to: toYmd(to),
  });
  return j.earningsCalendar ?? [];
}

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

const FINNHUB_EARNINGS_HOUR_CODES = new Set(['bmo', 'amc', 'dmh', 'dmt']);

export function mapEarningsToEvents(rows: FinnhubEarningsRow[]): CalendarEvent[] {
  return rows.map((r) => {
    const hourRaw = String(r.hour ?? '').trim();
    const hourLower = hourRaw.toLowerCase();
    const earningsHourCode = FINNHUB_EARNINGS_HOUR_CODES.has(hourLower) ? hourLower : undefined;
    const time = earningsHourCode ? '' : hourRaw || '—';
    return {
      id: `e-${r.symbol}-${r.date}-${r.quarter}-${r.year}`,
      date: r.date,
      time,
      earningsHourCode,
      title: `${r.symbol} (FY${r.year} Q${r.quarter})`,
      type: 'earnings' as const,
    };
  });
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
    const impact = r.impact?.trim().toLowerCase();
    return {
      id: `m-${r.country}-${i}-${r.time}`,
      date: r.time ? r.time.slice(0, 10) : '—',
      time,
      title: r.event,
      type,
      impact: impact === 'high' || impact === 'medium' || impact === 'low' ? impact : undefined,
      actual: r.actual,
      estimate: r.estimate,
      prev: r.prev,
      unit: r.unit,
      country: r.country,
    };
  });
}

export async function fetchCalendarEventsMerged(
  daysAhead = 14,
  options?: {
    scope: CalendarConcallScope;
    watchlistSymbols?: string[];
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
    earn = earn.filter((r) => r.symbol && MEGA_CAP_SET.has(normalizeEarningsSymbolForMatch(r.symbol)));
  } else {
    const syms = options?.watchlistSymbols ?? [];
    const set = new Set(syms.map((s) => normalizeEarningsSymbolForMatch(s)).filter(Boolean));
    if (set.size === 0) {
      earn = [];
    } else {
      earn = earn.filter((r) => r.symbol && set.has(normalizeEarningsSymbolForMatch(r.symbol)));
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
