import { megaCapRank, normalizeEarningsSymbolForMatch, normalizeMegaCapTicker } from '@/constants/megaCapUniverse';
import type { FinnhubEarningsRow } from '@/integrations/finnhub/types';

/** Finnhub `date` (YYYY-MM-DD) 로컬 자정 기준 */
export function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

export function isEarningsDateInFuture(ymd: string): boolean {
  const t = parseYmdLocal(ymd).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return t > today.getTime();
}

export function sortEarningsRowsForTranscript(
  rows: FinnhubEarningsRow[],
  useMegaRank: boolean,
): FinnhubEarningsRow[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return [...rows].sort((a, b) => {
    const da = parseYmdLocal(a.date).getTime();
    const db = parseYmdLocal(b.date).getTime();
    const aPast = da <= today.getTime();
    const bPast = db <= today.getTime();
    if (aPast !== bPast) return aPast ? -1 : 1;
    if (useMegaRank) {
      const ra = megaCapRank(a.symbol);
      const rb = megaCapRank(b.symbol);
      if (ra !== rb) return ra - rb;
    }
    if (da !== db) return da - db;
    return a.symbol.localeCompare(b.symbol);
  });
}

export const CONCALL_TRANSCRIPT_SNIPPET_MAX_CHARS = 14_000;

export function clipTranscriptForDisplay(raw: string, maxChars: number): string {
  const t = raw.trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trimEnd()}…`;
}

export function rowMatchesFiscalSelection(
  r: FinnhubEarningsRow,
  fiscalYear: number,
  fiscalQuarter: 0 | 1 | 2 | 3 | 4,
): boolean {
  const y = String(fiscalYear);
  const inCalendarYear = r.date >= `${y}-01-01` && r.date <= `${y}-12-31`;
  const inFiscalYearField = r.year === fiscalYear;
  const yearOk = inCalendarYear || inFiscalYearField;
  if (!yearOk) return false;
  if (fiscalQuarter === 0) return true;
  return r.quarter === fiscalQuarter;
}

export function normalizeConcallWatchSet(symbols: string[] | undefined): Set<string> {
  return new Set(
    (symbols ?? [])
      .map((s) => normalizeMegaCapTicker(s.trim().toUpperCase()))
      .filter((s) => s.length > 0),
  );
}

export function pickSymbolsFromEarningsRows(rows: FinnhubEarningsRow[], maxItems: number): string[] {
  return Array.from(
    new Set(
      rows
        .map((r) => r.symbol)
        .filter(Boolean)
        .slice(0, maxItems * 2),
    ),
  ).slice(0, maxItems);
}
